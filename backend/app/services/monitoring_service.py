"""
Background Monitoring Service
Continuously monitors CDC pipelines for anomalies and triggers alerts.
"""

import asyncio
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from app.services.anomaly_detector import anomaly_detector
from app.services.alert_service import alert_service


class MonitoringService:
    """
    Background service that monitors pipelines and triggers alerts.
    Runs as an async task checking for anomalies periodically.
    """

    def __init__(self):
        self.check_interval_seconds = int(os.getenv("MONITOR_INTERVAL_SECONDS", "60"))
        self.is_running = False
        self._task = None
        # Cache to track last event times per pipeline
        self._last_event_cache: Dict[str, datetime] = {}
        # Cache to track event counts for volume detection
        self._event_count_cache: Dict[str, List[int]] = {}

    def _get_session(self):
        """Get database session"""
        from app.services.db_service import db_service
        return db_service._get_session()

    async def start(self):
        """Start the background monitoring loop"""
        if self.is_running:
            print("[MONITOR] Already running")
            return

        self.is_running = True
        self._task = asyncio.create_task(self._monitoring_loop())
        print(f"[MONITOR] Started background monitoring (interval: {self.check_interval_seconds}s)")

    async def stop(self):
        """Stop the background monitoring loop"""
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        print("[MONITOR] Stopped background monitoring")

    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_running:
            try:
                await self._check_all_pipelines()
            except Exception as e:
                print(f"[MONITOR] Error in monitoring loop: {e}")

            await asyncio.sleep(self.check_interval_seconds)

    async def _check_all_pipelines(self):
        """Check all active pipelines for anomalies"""
        from app.db.models import Pipeline, AlertRule

        session = self._get_session()
        try:
            # Get all running pipelines
            pipelines = session.query(Pipeline).filter(
                Pipeline.status == 'running'
            ).all()

            for pipeline in pipelines:
                await self._check_pipeline(pipeline, session)

        except Exception as e:
            print(f"[MONITOR] Error checking pipelines: {e}")
        finally:
            session.close()

    async def _check_pipeline(self, pipeline, session):
        """Check a single pipeline for anomalies"""
        from app.db.models import AlertRule

        pipeline_id = pipeline.id
        user_id = pipeline.user_id

        # Get alert rules for this pipeline
        rules = session.query(AlertRule).filter(
            AlertRule.pipeline_id == pipeline_id,
            AlertRule.is_active == True
        ).all()

        if not rules:
            # Also check rules without specific pipeline (user-wide rules)
            rules = session.query(AlertRule).filter(
                AlertRule.user_id == user_id,
                AlertRule.pipeline_id == None,
                AlertRule.is_active == True
            ).all()

        if not rules:
            return

        # Get metrics for this pipeline
        metrics = await self._get_pipeline_metrics(pipeline)
        if not metrics:
            return

        # Check each rule type
        for rule in rules:
            anomaly = None

            if rule.rule_type == 'gap_detection':
                anomaly = self._check_gap(
                    pipeline_id,
                    metrics.get('last_event_time'),
                    rule.threshold_config.get('minutes', 5)
                )

            elif rule.rule_type == 'volume_spike':
                anomaly = self._check_volume_spike(
                    pipeline_id,
                    metrics.get('event_count', 0),
                    rule.threshold_config.get('multiplier', 3.0)
                )

            elif rule.rule_type == 'volume_drop':
                anomaly = self._check_volume_drop(
                    pipeline_id,
                    metrics.get('event_count', 0),
                    rule.threshold_config.get('threshold', 0.2)
                )

            if anomaly:
                # Add pipeline info to anomaly
                anomaly['pipeline_id'] = pipeline_id
                anomaly['pipeline_name'] = pipeline.name

                # Send alert
                try:
                    result = alert_service.send_alert(rule.id, anomaly)
                    if result:
                        print(f"[MONITOR] Alert sent for pipeline {pipeline.name}: {anomaly['type']}")
                except Exception as e:
                    print(f"[MONITOR] Failed to send alert: {e}")

    async def _get_pipeline_metrics(self, pipeline) -> Optional[Dict[str, Any]]:
        """Get current metrics for a pipeline by querying the source database"""
        from app.services.credential_service import credential_service

        try:
            # Get the credential for this pipeline
            credential_id = pipeline.source_credential_id
            if not credential_id:
                return None

            user_id = pipeline.user_id
            creds = credential_service.get_decrypted_credentials(user_id, credential_id)
            if not creds:
                return None

            # Get source tables
            source_tables = pipeline.source_tables or []
            if not source_tables:
                return None

            # Query the source database for metrics
            import psycopg2
            conn_info = creds['credentials']
            conn = psycopg2.connect(
                host=conn_info.get('host'),
                port=conn_info.get('port', 5432),
                database=conn_info.get('database'),
                user=conn_info.get('username'),
                password=conn_info.get('password'),
                connect_timeout=5
            )

            metrics = {
                'pipeline_id': pipeline.id,
                'tables': {},
                'total_event_count': 0,
                'last_event_time': None
            }

            cursor = conn.cursor()
            for table in source_tables:
                # Try to get count and max timestamp
                # Assume tables have a created_at or similar timestamp column
                try:
                    # Get count of recent events (last hour)
                    cursor.execute(f"""
                        SELECT COUNT(*), MAX(created_at)
                        FROM {table}
                        WHERE created_at > NOW() - INTERVAL '1 hour'
                    """)
                    row = cursor.fetchone()
                    count = row[0] or 0
                    last_time = row[1]

                    metrics['tables'][table] = {
                        'count': count,
                        'last_event_time': last_time
                    }
                    metrics['total_event_count'] += count

                    if last_time:
                        if metrics['last_event_time'] is None or last_time > metrics['last_event_time']:
                            metrics['last_event_time'] = last_time

                except Exception as e:
                    # Table might not have created_at column
                    print(f"[MONITOR] Could not query {table}: {e}")

            cursor.close()
            conn.close()

            # Also set event_count for volume checks
            metrics['event_count'] = metrics['total_event_count']

            return metrics

        except Exception as e:
            print(f"[MONITOR] Error getting metrics for pipeline {pipeline.id}: {e}")
            return None

    def _check_gap(
        self,
        pipeline_id: str,
        last_event_time: Optional[datetime],
        gap_minutes: int
    ) -> Optional[Dict[str, Any]]:
        """Check for event gaps"""
        if not last_event_time:
            return None

        # Use anomaly detector
        anomaly = anomaly_detector.detect_gap(last_event_time, gap_minutes)
        return anomaly

    def _check_volume_spike(
        self,
        pipeline_id: str,
        current_count: int,
        multiplier: float
    ) -> Optional[Dict[str, Any]]:
        """Check for volume spikes"""
        # Get historical counts for baseline
        history = self._event_count_cache.get(pipeline_id, [])

        # Update cache
        history.append(current_count)
        if len(history) > 10:
            history = history[-10:]
        self._event_count_cache[pipeline_id] = history

        # Need at least 3 data points for baseline
        if len(history) < 3:
            return None

        # Calculate baseline (average of previous counts, excluding current)
        baseline = sum(history[:-1]) / len(history[:-1])

        # Use anomaly detector
        anomaly = anomaly_detector.detect_volume_spike(current_count, baseline, multiplier)
        return anomaly

    def _check_volume_drop(
        self,
        pipeline_id: str,
        current_count: int,
        threshold: float
    ) -> Optional[Dict[str, Any]]:
        """Check for volume drops"""
        # Get historical counts for baseline
        history = self._event_count_cache.get(pipeline_id, [])

        if len(history) < 3:
            return None

        # Calculate baseline
        baseline = sum(history[:-1]) / len(history[:-1])

        # Use anomaly detector
        anomaly = anomaly_detector.detect_volume_drop(current_count, baseline, threshold)
        return anomaly

    def check_now(self, pipeline_id: str = None) -> Dict[str, Any]:
        """
        Manually trigger a check (for testing/debugging).
        Returns anomalies found.
        """
        from app.db.models import Pipeline

        session = self._get_session()
        anomalies = []

        try:
            if pipeline_id:
                pipelines = session.query(Pipeline).filter(
                    Pipeline.id == pipeline_id
                ).all()
            else:
                pipelines = session.query(Pipeline).filter(
                    Pipeline.status == 'running'
                ).all()

            for pipeline in pipelines:
                # Run sync version of check
                import asyncio
                loop = asyncio.new_event_loop()
                try:
                    loop.run_until_complete(self._check_pipeline(pipeline, session))
                finally:
                    loop.close()

        finally:
            session.close()

        return {'checked_at': datetime.utcnow().isoformat(), 'pipelines_checked': len(pipelines)}


# Singleton instance
monitoring_service = MonitoringService()
