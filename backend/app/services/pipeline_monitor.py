"""
Pipeline Monitor Service
Monitors CDC pipeline health, lag, throughput, and errors.
"""

import os
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta


class PipelineMonitor:
    """
    Service for monitoring CDC pipeline health and metrics.
    Aggregates status from connectors, topics, and sinks.
    """

    def __init__(self):
        self._db_session = None

    def _get_session(self):
        """Get database session"""
        from app.services.db_service import db_service
        return db_service._get_session()

    def get_pipeline_health(self, pipeline_id: str) -> Dict[str, Any]:
        """
        Get comprehensive pipeline health status.

        Args:
            pipeline_id: Pipeline ID

        Returns:
            Health status with connector states, metrics, and errors
        """
        from app.db.models import Pipeline, PipelineEvent
        from app.services.confluent_connector_service import confluent_connector_service

        session = self._get_session()
        try:
            # Get pipeline from database
            pipeline = session.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
            if not pipeline:
                raise ValueError(f"Pipeline {pipeline_id} not found")

            # Determine overall status
            status = 'HEALTHY'
            errors = []

            # Check source connector status
            source_connector_status = None
            if pipeline.source_connector_name:
                try:
                    source_connector_status = confluent_connector_service.get_connector_status(
                        pipeline.source_connector_name
                    )
                    connector_state = source_connector_status.get('connector', {}).get('state', 'UNKNOWN')
                    if connector_state == 'FAILED':
                        status = 'FAILED'
                        errors.append({
                            'component': 'source_connector',
                            'message': source_connector_status.get('connector', {}).get('trace', 'Connector failed')
                        })
                    elif connector_state == 'PAUSED':
                        status = 'PAUSED'
                except Exception as e:
                    errors.append({
                        'component': 'source_connector',
                        'message': f"Failed to get connector status: {str(e)}"
                    })
                    status = 'DEGRADED'

            # Check sink connector status
            sink_connector_status = None
            if pipeline.sink_connector_name:
                try:
                    sink_connector_status = confluent_connector_service.get_connector_status(
                        pipeline.sink_connector_name
                    )
                    connector_state = sink_connector_status.get('connector', {}).get('state', 'UNKNOWN')
                    if connector_state == 'FAILED':
                        status = 'FAILED'
                        errors.append({
                            'component': 'sink_connector',
                            'message': sink_connector_status.get('connector', {}).get('trace', 'Sink failed')
                        })
                except Exception as e:
                    errors.append({
                        'component': 'sink_connector',
                        'message': f"Failed to get sink status: {str(e)}"
                    })
                    if status == 'HEALTHY':
                        status = 'DEGRADED'

            # Get recent events
            recent_events = session.query(PipelineEvent).filter(
                PipelineEvent.pipeline_id == pipeline_id
            ).order_by(PipelineEvent.created_at.desc()).limit(10).all()

            # Check for recent errors in events
            for event in recent_events:
                if event.event_type == 'error':
                    if status == 'HEALTHY':
                        status = 'DEGRADED'
                    errors.append({
                        'component': 'pipeline',
                        'message': event.message,
                        'timestamp': event.created_at.isoformat() if event.created_at else None
                    })

            # Build health response
            health = {
                'pipeline_id': pipeline_id,
                'pipeline_name': pipeline.name,
                'status': status if pipeline.status != 'stopped' else 'STOPPED',
                'source_connector': {
                    'name': pipeline.source_connector_name,
                    'status': source_connector_status
                } if source_connector_status else None,
                'sink_connector': {
                    'name': pipeline.sink_connector_name,
                    'status': sink_connector_status
                } if sink_connector_status else None,
                'errors': errors,
                'last_health_check': datetime.utcnow().isoformat(),
                'pipeline_status': pipeline.status,
                'started_at': pipeline.started_at.isoformat() if pipeline.started_at else None
            }

            # Update pipeline health in database
            pipeline.last_health_check = datetime.utcnow()
            pipeline.metrics_cache = health
            pipeline.metrics_updated_at = datetime.utcnow()
            session.commit()

            return health

        except ValueError:
            raise
        except Exception as e:
            raise Exception(f"Failed to get pipeline health: {str(e)}")
        finally:
            session.close()

    def get_lag_metrics(self, pipeline_id: str) -> Dict[str, Any]:
        """
        Get lag metrics for a pipeline.

        Args:
            pipeline_id: Pipeline ID

        Returns:
            Lag information including per-partition details
        """
        from app.db.models import Pipeline
        from app.services.topic_service import topic_service

        session = self._get_session()
        try:
            pipeline = session.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
            if not pipeline:
                raise ValueError(f"Pipeline {pipeline_id} not found")

            # Get source tables to determine topics
            source_tables = pipeline.source_tables or []
            server_name = f"dataflow_{pipeline_id[:8]}"

            lag_info = {
                'pipeline_id': pipeline_id,
                'topics': [],
                'total_lag_messages': 0,
                'estimated_lag_seconds': 0
            }

            for table in source_tables:
                topic_name = f"{server_name}.{table.replace('.', '_')}"
                topic_info = topic_service.get_topic_info(topic_name)

                if topic_info.get('exists'):
                    lag_info['topics'].append({
                        'topic': topic_name,
                        'partitions': topic_info.get('partition_count', 0),
                        'info': topic_info
                    })

            return lag_info

        finally:
            session.close()

    def get_throughput_metrics(
        self,
        pipeline_id: str,
        window_seconds: int = 60
    ) -> Dict[str, Any]:
        """
        Get throughput metrics for a pipeline.

        Args:
            pipeline_id: Pipeline ID
            window_seconds: Time window for metrics

        Returns:
            Throughput information
        """
        from app.db.models import Pipeline

        session = self._get_session()
        try:
            pipeline = session.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
            if not pipeline:
                raise ValueError(f"Pipeline {pipeline_id} not found")

            # In a real implementation, this would query Kafka metrics or a metrics store
            # For now, return placeholder metrics
            return {
                'pipeline_id': pipeline_id,
                'window_seconds': window_seconds,
                'events_per_second': 0.0,
                'bytes_per_second': 0.0,
                'peak_events_per_second': 0.0,
                'time_series': [],
                'note': 'Real metrics require Kafka metrics integration'
            }

        finally:
            session.close()

    def get_error_log(
        self,
        pipeline_id: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get recent errors for a pipeline.

        Args:
            pipeline_id: Pipeline ID
            limit: Maximum number of errors to return

        Returns:
            List of error events
        """
        from app.db.models import PipelineEvent

        session = self._get_session()
        try:
            events = session.query(PipelineEvent).filter(
                PipelineEvent.pipeline_id == pipeline_id,
                PipelineEvent.event_type == 'error'
            ).order_by(PipelineEvent.created_at.desc()).limit(limit).all()

            return [
                {
                    'id': event.id,
                    'message': event.message,
                    'details': event.details,
                    'created_at': event.created_at.isoformat() if event.created_at else None
                }
                for event in events
            ]

        finally:
            session.close()

    def log_event(
        self,
        pipeline_id: str,
        event_type: str,
        message: str,
        details: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Log a pipeline event.

        Args:
            pipeline_id: Pipeline ID
            event_type: Event type (created, started, paused, resumed, stopped, failed, error)
            message: Event message
            details: Additional event details

        Returns:
            Created event
        """
        import uuid
        from app.db.models import PipelineEvent

        session = self._get_session()
        try:
            event = PipelineEvent(
                id=str(uuid.uuid4()),
                pipeline_id=pipeline_id,
                event_type=event_type,
                message=message,
                details=details or {},
                created_at=datetime.utcnow()
            )

            session.add(event)
            session.commit()
            session.refresh(event)

            print(f"[PIPELINE] Event logged: {event_type} - {message}")
            return {
                'id': event.id,
                'pipeline_id': pipeline_id,
                'event_type': event_type,
                'message': message,
                'created_at': event.created_at.isoformat()
            }

        except Exception as e:
            session.rollback()
            raise Exception(f"Failed to log event: {str(e)}")
        finally:
            session.close()

    def get_all_pipelines_health(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get health status for all user's pipelines.

        Args:
            user_id: User ID

        Returns:
            List of pipeline health summaries
        """
        from app.db.models import Pipeline

        session = self._get_session()
        try:
            pipelines = session.query(Pipeline).filter(
                Pipeline.user_id == user_id
            ).all()

            health_summaries = []
            for pipeline in pipelines:
                health_summaries.append({
                    'pipeline_id': pipeline.id,
                    'name': pipeline.name,
                    'status': pipeline.status,
                    'last_health_check': pipeline.last_health_check.isoformat() if pipeline.last_health_check else None,
                    'started_at': pipeline.started_at.isoformat() if pipeline.started_at else None,
                    'error_message': pipeline.error_message
                })

            return health_summaries

        finally:
            session.close()


# Singleton instance
pipeline_monitor = PipelineMonitor()
