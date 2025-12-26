"""
Anomaly Detector Service
Detects anomalies in transformed data by comparing with original data.
Includes volume-based and gap detection for pipeline health monitoring.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional


class AnomalyDetectorService:
    """Detect data anomalies in transformations."""

    def analyze(
        self,
        original_data: Dict[str, Any],
        transformed_data: Dict[str, Any],
        transformation_type: str,
        config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze transformed data for anomalies

        Args:
            original_data: Original sample data (before transformation)
            transformed_data: Transformed data (after transformation)
            transformation_type: Type of transformation (join, filter, aggregation)
            config: Anomaly detection configuration thresholds

        Returns:
            Anomalies detected, summary, and whether pipeline can proceed
        """
        # Default thresholds
        default_config = {
            'null_ratio_warning': 0.05,  # 5%
            'null_ratio_error': 0.20,    # 20%
            'cardinality_multiplier': 2.0,  # 2x
            'row_count_drop_warning': 0.50  # 50% row drop
        }

        # Merge with provided config
        thresholds = {**default_config, **(config or {})}

        anomalies = []
        summary = {
            'errors': 0,
            'warnings': 0,
            'info': 0
        }

        # Extract row counts
        original_rows = original_data.get('row_count', 0)
        transformed_rows = transformed_data.get('row_count', 0)
        transformed_columns = transformed_data.get('columns', [])
        transformed_stats = transformed_data.get('stats', {})

        # 1. NULL RATIO CHECK
        null_counts = transformed_stats.get('null_counts', {})
        for col_name, null_count in null_counts.items():
            if transformed_rows > 0:
                null_ratio = null_count / transformed_rows

                if null_ratio > thresholds['null_ratio_error']:
                    anomalies.append({
                        'type': 'null_ratio',
                        'severity': 'error',
                        'column': col_name,
                        'message': f"Column '{col_name}' has {null_ratio*100:.1f}% NULL values (threshold: {thresholds['null_ratio_error']*100:.1f}%)",
                        'details': {
                            'null_count': null_count,
                            'total_rows': transformed_rows,
                            'null_ratio': round(null_ratio, 4)
                        }
                    })
                    summary['errors'] += 1

                elif null_ratio > thresholds['null_ratio_warning']:
                    anomalies.append({
                        'type': 'null_ratio',
                        'severity': 'warning',
                        'column': col_name,
                        'message': f"Column '{col_name}' has {null_ratio*100:.1f}% NULL values (threshold: {thresholds['null_ratio_warning']*100:.1f}%)",
                        'details': {
                            'null_count': null_count,
                            'total_rows': transformed_rows,
                            'null_ratio': round(null_ratio, 4)
                        }
                    })
                    summary['warnings'] += 1

        # 2. CARDINALITY CHECK (for joins)
        if transformation_type == 'join' and original_rows > 0:
            cardinality_ratio = transformed_rows / original_rows

            if cardinality_ratio > thresholds['cardinality_multiplier']:
                anomalies.append({
                    'type': 'cardinality',
                    'severity': 'warning',
                    'column': None,
                    'message': f"JOIN produced {cardinality_ratio:.2f}x more rows than original (threshold: {thresholds['cardinality_multiplier']}x). Possible cartesian product.",
                    'details': {
                        'original_rows': original_rows,
                        'output_rows': transformed_rows,
                        'cardinality_ratio': round(cardinality_ratio, 2)
                    }
                })
                summary['warnings'] += 1

        # 3. ROW COUNT DROP CHECK (for filters)
        if transformation_type == 'filter' and original_rows > 0:
            row_drop_ratio = 1 - (transformed_rows / original_rows)

            if row_drop_ratio > thresholds['row_count_drop_warning']:
                anomalies.append({
                    'type': 'row_count_drop',
                    'severity': 'info',
                    'column': None,
                    'message': f"FILTER reduced rows by {row_drop_ratio*100:.1f}% ({original_rows} → {transformed_rows}). Verify filter condition is correct.",
                    'details': {
                        'original_rows': original_rows,
                        'output_rows': transformed_rows,
                        'drop_ratio': round(row_drop_ratio, 4)
                    }
                })
                summary['info'] += 1

        # 4. TYPE COERCION CHECK
        # Compare column types if original data has column metadata
        original_columns = original_data.get('columns', [])
        if original_columns:
            original_col_map = {col['name']: col for col in original_columns}

            for transformed_col in transformed_columns:
                col_name = transformed_col['name']
                transformed_type = transformed_col.get('type', '')

                if col_name in original_col_map:
                    original_type = original_col_map[col_name].get('type', '')

                    # Check if type changed (excluding expected aggregations)
                    if original_type and transformed_type and original_type != transformed_type:
                        # Skip if this is an aggregation (expected type change)
                        if transformation_type != 'aggregation':
                            anomalies.append({
                                'type': 'type_coercion',
                                'severity': 'info',
                                'column': col_name,
                                'message': f"Column '{col_name}' type changed from {original_type} to {transformed_type}",
                                'details': {
                                    'original_type': original_type,
                                    'transformed_type': transformed_type
                                }
                            })
                            summary['info'] += 1

        # Determine if pipeline can proceed
        can_proceed = summary['errors'] == 0

        print(f"[ANOMALY_DETECTOR] Analyzed {transformation_type}: {summary['errors']} errors, {summary['warnings']} warnings, {summary['info']} info")

        return {
            'anomalies': anomalies,
            'summary': summary,
            'can_proceed': can_proceed,
            'transformation_type': transformation_type,
            'thresholds_used': thresholds
        }


    # ========== VOLUME-BASED ANOMALY DETECTION ==========

    def detect_volume_spike(
        self,
        current_count: int,
        baseline_count: float,
        threshold: float = 3.0
    ) -> Optional[Dict[str, Any]]:
        """
        Detect if current volume exceeds threshold * baseline.

        Args:
            current_count: Current event count in the time window
            baseline_count: Average/expected event count (baseline)
            threshold: Multiplier threshold (default 3.0 = 3x normal)

        Returns:
            Anomaly dict if spike detected, None otherwise
        """
        if baseline_count <= 0:
            return None

        multiplier = current_count / baseline_count
        if multiplier > threshold:
            anomaly = {
                'type': 'volume_spike',
                'severity': 'warning' if multiplier < threshold * 2 else 'critical',
                'message': f'Volume spike detected: {current_count} events ({multiplier:.1f}x baseline of {baseline_count:.0f})',
                'details': {
                    'current_count': current_count,
                    'baseline_count': round(baseline_count, 1),
                    'multiplier': round(multiplier, 2),
                    'threshold': threshold,
                    'detected_at': datetime.utcnow().isoformat()
                }
            }
            print(f"[ANOMALY_DETECTOR] Volume spike: {current_count} events ({multiplier:.1f}x baseline)")
            return anomaly

        return None

    def detect_volume_drop(
        self,
        current_count: int,
        baseline_count: float,
        threshold: float = 0.2
    ) -> Optional[Dict[str, Any]]:
        """
        Detect if current volume dropped below threshold * baseline.

        Args:
            current_count: Current event count in the time window
            baseline_count: Average/expected event count (baseline)
            threshold: Ratio threshold (default 0.2 = 80% drop)

        Returns:
            Anomaly dict if drop detected, None otherwise
        """
        if baseline_count <= 0:
            return None

        ratio = current_count / baseline_count
        if ratio < threshold:
            drop_percent = (1 - ratio) * 100
            anomaly = {
                'type': 'volume_drop',
                'severity': 'warning' if ratio > threshold / 2 else 'critical',
                'message': f'Volume drop detected: {current_count} events ({drop_percent:.0f}% drop from baseline of {baseline_count:.0f})',
                'details': {
                    'current_count': current_count,
                    'baseline_count': round(baseline_count, 1),
                    'ratio': round(ratio, 4),
                    'drop_percent': round(drop_percent, 1),
                    'threshold': threshold,
                    'detected_at': datetime.utcnow().isoformat()
                }
            }
            print(f"[ANOMALY_DETECTOR] Volume drop: {current_count} events ({drop_percent:.0f}% drop)")
            return anomaly

        return None

    def detect_gap(
        self,
        last_event_time: datetime,
        gap_threshold_minutes: int = 5
    ) -> Optional[Dict[str, Any]]:
        """
        Detect if no events for > threshold minutes.

        Args:
            last_event_time: Timestamp of the last event received
            gap_threshold_minutes: Minutes without events to trigger (default 5)

        Returns:
            Anomaly dict if gap detected, None otherwise
        """
        gap_seconds = (datetime.utcnow() - last_event_time).total_seconds()
        gap_minutes = gap_seconds / 60

        if gap_minutes >= gap_threshold_minutes:
            anomaly = {
                'type': 'gap_detection',
                'severity': 'critical' if gap_minutes >= gap_threshold_minutes * 2 else 'warning',
                'message': f'Event gap detected: no events for {gap_minutes:.1f} minutes (threshold: {gap_threshold_minutes} min)',
                'details': {
                    'gap_minutes': round(gap_minutes, 2),
                    'gap_seconds': round(gap_seconds, 0),
                    'threshold_minutes': gap_threshold_minutes,
                    'last_event_time': last_event_time.isoformat(),
                    'detected_at': datetime.utcnow().isoformat()
                }
            }
            print(f"[ANOMALY_DETECTOR] Event gap: {gap_minutes:.1f} minutes since last event")
            return anomaly

        return None

    def detect_missing_entity_events(
        self,
        entity_id: str,
        entity_type: str,
        last_event_time: Optional[datetime],
        expected_interval_minutes: int = 10
    ) -> Optional[Dict[str, Any]]:
        """
        Detect if a specific entity (e.g., user) hasn't generated events.

        Args:
            entity_id: ID of the entity (user_id, device_id, etc.)
            entity_type: Type of entity ("user", "device", etc.)
            last_event_time: Last event time for this entity
            expected_interval_minutes: Expected max interval between events

        Returns:
            Anomaly dict if missing events detected, None otherwise
        """
        if not last_event_time:
            return {
                'type': 'missing_entity_events',
                'severity': 'info',
                'message': f'No events found for {entity_type} {entity_id}',
                'details': {
                    'entity_id': entity_id,
                    'entity_type': entity_type,
                    'last_event_time': None,
                    'detected_at': datetime.utcnow().isoformat()
                }
            }

        gap_minutes = (datetime.utcnow() - last_event_time).total_seconds() / 60

        if gap_minutes >= expected_interval_minutes:
            anomaly = {
                'type': 'missing_entity_events',
                'severity': 'warning',
                'message': f'No events from {entity_type} {entity_id} for {gap_minutes:.1f} minutes',
                'details': {
                    'entity_id': entity_id,
                    'entity_type': entity_type,
                    'gap_minutes': round(gap_minutes, 2),
                    'expected_interval_minutes': expected_interval_minutes,
                    'last_event_time': last_event_time.isoformat(),
                    'detected_at': datetime.utcnow().isoformat()
                }
            }
            print(f"[ANOMALY_DETECTOR] Missing events for {entity_type} {entity_id}: {gap_minutes:.1f} min")
            return anomaly

        return None

    def analyze_with_template(
        self,
        metrics: Dict[str, Any],
        anomaly_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Analyze metrics using template-based anomaly configuration.

        Args:
            metrics: Current pipeline metrics including:
                - current_count: Events in current window
                - baseline_count: Expected events (rolling average)
                - last_event_time: Timestamp of last event (datetime or ISO string)
            anomaly_config: Template anomaly configuration:
                - volume_spike: {enabled, multiplier}
                - volume_drop: {enabled, threshold}
                - gap_detection: {enabled, minutes}

        Returns:
            List of detected anomalies
        """
        anomalies = []

        # Volume spike detection
        spike_config = anomaly_config.get('volume_spike', {})
        if spike_config.get('enabled', False):
            current = metrics.get('current_count', 0)
            baseline = metrics.get('baseline_count', 0)
            threshold = spike_config.get('multiplier', 3.0)

            spike = self.detect_volume_spike(current, baseline, threshold)
            if spike:
                anomalies.append(spike)

        # Volume drop detection
        drop_config = anomaly_config.get('volume_drop', {})
        if drop_config.get('enabled', False):
            current = metrics.get('current_count', 0)
            baseline = metrics.get('baseline_count', 0)
            threshold = drop_config.get('threshold', 0.2)

            drop = self.detect_volume_drop(current, baseline, threshold)
            if drop:
                anomalies.append(drop)

        # Gap detection
        gap_config = anomaly_config.get('gap_detection', {})
        if gap_config.get('enabled', False):
            last_event = metrics.get('last_event_time')
            if last_event:
                # Convert from ISO string if needed
                if isinstance(last_event, str):
                    last_event = datetime.fromisoformat(last_event.replace('Z', '+00:00'))

                threshold_minutes = gap_config.get('minutes', 5)
                gap = self.detect_gap(last_event, threshold_minutes)
                if gap:
                    anomalies.append(gap)

        return anomalies


# Singleton instance
anomaly_detector = AnomalyDetectorService()
