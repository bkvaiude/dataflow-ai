"""
Cleanup Service

Performs ordered cleanup of pipeline resources.
This is critical for the "no cost wastage" principle - when a pipeline is deleted,
ALL resources should be cleaned up to avoid lingering costs.

Cleanup Order:
1. Sink connectors (stop data flow to destination)
2. Alert rules (stop monitoring)
3. ksqlDB tables (stop aggregations)
4. ksqlDB streams (stop transformations)
5. Source connectors (stop data capture)
6. Kafka topics (remove data)
7. Destination tables (optional - keep data by default)
8. Debezium slots/publications (PostgreSQL cleanup)
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import asyncio
import logging

from app.services.resource_tracker import (
    resource_tracker,
    ResourceType,
    ResourceStatus,
    TrackedResource,
    PipelineResources
)

logger = logging.getLogger(__name__)


@dataclass
class CleanupResult:
    """Result of a single resource cleanup"""
    resource_id: str
    resource_type: str
    resource_name: str
    success: bool
    error: Optional[str] = None
    skipped: bool = False
    skip_reason: Optional[str] = None


@dataclass
class PipelineCleanupResult:
    """Result of cleaning up an entire pipeline"""
    pipeline_id: str
    success: bool
    total_resources: int
    cleaned: int
    failed: int
    skipped: int
    results: List[CleanupResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    cost_savings: Optional[Dict] = None
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    duration_seconds: float = 0.0

    def to_dict(self) -> Dict:
        return {
            "pipeline_id": self.pipeline_id,
            "success": self.success,
            "total_resources": self.total_resources,
            "cleaned": self.cleaned,
            "failed": self.failed,
            "skipped": self.skipped,
            "results": [
                {
                    "resource_id": r.resource_id,
                    "resource_type": r.resource_type,
                    "resource_name": r.resource_name,
                    "success": r.success,
                    "error": r.error,
                    "skipped": r.skipped,
                    "skip_reason": r.skip_reason
                }
                for r in self.results
            ],
            "errors": self.errors,
            "cost_savings": self.cost_savings,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_seconds": self.duration_seconds
        }


@dataclass
class CleanupOptions:
    """Options for cleanup behavior"""
    delete_kafka_topics: bool = True      # Delete Kafka topics
    delete_ksqldb_resources: bool = True  # Delete ksqlDB streams/tables
    delete_connectors: bool = True        # Delete source/sink connectors
    delete_destination_data: bool = False # Keep destination data by default
    delete_alert_rules: bool = True       # Delete alert configurations
    cleanup_debezium: bool = True         # Clean up PostgreSQL replication slots
    dry_run: bool = False                 # If True, don't actually delete


class CleanupService:
    """
    Service for cleaning up pipeline resources in the correct order.

    Ensures:
    - Dependencies are respected (sinks before sources before topics)
    - Errors don't stop cleanup (continue with remaining resources)
    - Failed resources are tracked for manual cleanup
    - Cost savings are calculated
    """

    def __init__(self):
        self._kafka_service = None
        self._ksqldb_service = None
        self._connector_service = None
        self._clickhouse_service = None
        self._alert_service = None

    def _get_services(self):
        """Lazy load services to avoid circular imports"""
        if self._kafka_service is None:
            from app.services.confluent_kafka_service import confluent_kafka_service
            from app.services.ksqldb_service import ksqldb_service
            from app.services.confluent_connector_service import confluent_connector_service
            from app.services.clickhouse_service import clickhouse_service
            # Alert service would go here when implemented

            self._kafka_service = confluent_kafka_service
            self._ksqldb_service = ksqldb_service
            self._connector_service = confluent_connector_service
            self._clickhouse_service = clickhouse_service

    async def cleanup_pipeline(
        self,
        pipeline_id: str,
        user_id: str,
        options: Optional[CleanupOptions] = None
    ) -> PipelineCleanupResult:
        """
        Clean up all resources for a pipeline.

        Args:
            pipeline_id: Pipeline to cleanup
            user_id: User performing the cleanup
            options: Cleanup options (what to delete, dry run, etc.)

        Returns:
            PipelineCleanupResult with details of what was cleaned up
        """
        self._get_services()
        options = options or CleanupOptions()

        result = PipelineCleanupResult(
            pipeline_id=pipeline_id,
            success=True,
            total_resources=0,
            cleaned=0,
            failed=0,
            skipped=0
        )

        # Get resources in deletion order
        resources = resource_tracker.get_deletion_order(pipeline_id)
        result.total_resources = len(resources)

        if not resources:
            logger.info(f"[CLEANUP] No resources to clean up for pipeline: {pipeline_id}")
            result.completed_at = datetime.utcnow()
            result.duration_seconds = (result.completed_at - result.started_at).total_seconds()
            return result

        logger.info(f"[CLEANUP] Starting cleanup of {len(resources)} resources for pipeline: {pipeline_id}")

        # Clean up each resource in order
        for resource in resources:
            cleanup_result = await self._cleanup_resource(resource, options)
            result.results.append(cleanup_result)

            if cleanup_result.success:
                result.cleaned += 1
                resource_tracker.mark_deleted(pipeline_id, resource.resource_id)
            elif cleanup_result.skipped:
                result.skipped += 1
            else:
                result.failed += 1
                result.errors.append(f"{resource.resource_type.value}: {cleanup_result.error}")
                result.success = False

        # Calculate cost savings
        result.cost_savings = self._calculate_cost_savings(resources)

        # Remove pipeline from tracker if all cleaned
        if result.failed == 0:
            resource_tracker.cleanup_deleted_pipeline(pipeline_id)

        result.completed_at = datetime.utcnow()
        result.duration_seconds = (result.completed_at - result.started_at).total_seconds()

        logger.info(
            f"[CLEANUP] Completed cleanup for pipeline {pipeline_id}: "
            f"{result.cleaned} cleaned, {result.failed} failed, {result.skipped} skipped "
            f"in {result.duration_seconds:.2f}s"
        )

        return result

    async def _cleanup_resource(
        self,
        resource: TrackedResource,
        options: CleanupOptions
    ) -> CleanupResult:
        """Clean up a single resource"""
        result = CleanupResult(
            resource_id=resource.resource_id,
            resource_type=resource.resource_type.value,
            resource_name=resource.resource_name,
            success=False
        )

        # Check if this resource type should be cleaned
        if not self._should_cleanup(resource.resource_type, options):
            result.skipped = True
            result.skip_reason = f"Cleanup disabled for {resource.resource_type.value}"
            result.success = True
            return result

        # Dry run - don't actually delete
        if options.dry_run:
            result.skipped = True
            result.skip_reason = "Dry run - would delete"
            result.success = True
            return result

        try:
            if resource.resource_type == ResourceType.SINK_CONNECTOR:
                await self._delete_connector(resource.resource_id)
            elif resource.resource_type == ResourceType.SOURCE_CONNECTOR:
                await self._delete_connector(resource.resource_id)
            elif resource.resource_type == ResourceType.KSQLDB_STREAM:
                await self._delete_ksqldb_stream(resource.resource_id)
            elif resource.resource_type == ResourceType.KSQLDB_TABLE:
                await self._delete_ksqldb_table(resource.resource_id)
            elif resource.resource_type == ResourceType.KAFKA_TOPIC:
                await self._delete_kafka_topic(resource.resource_id)
            elif resource.resource_type == ResourceType.CLICKHOUSE_TABLE:
                if options.delete_destination_data:
                    await self._delete_clickhouse_table(resource.resource_id, resource.metadata)
                else:
                    result.skipped = True
                    result.skip_reason = "Keeping destination data"
            elif resource.resource_type == ResourceType.ALERT_RULE:
                await self._delete_alert_rule(resource.resource_id)
            elif resource.resource_type == ResourceType.DEBEZIUM_SLOT:
                await self._delete_debezium_slot(resource.resource_id, resource.metadata)
            elif resource.resource_type == ResourceType.DEBEZIUM_PUBLICATION:
                await self._delete_debezium_publication(resource.resource_id, resource.metadata)
            else:
                result.skipped = True
                result.skip_reason = f"Unknown resource type: {resource.resource_type}"

            if not result.skipped:
                result.success = True
                logger.info(f"[CLEANUP] Deleted {resource.resource_type.value}: {resource.resource_id}")

        except Exception as e:
            result.error = str(e)
            logger.error(f"[CLEANUP] Failed to delete {resource.resource_type.value}: {resource.resource_id} - {e}")

        return result

    def _should_cleanup(self, resource_type: ResourceType, options: CleanupOptions) -> bool:
        """Check if a resource type should be cleaned based on options"""
        if resource_type in [ResourceType.SOURCE_CONNECTOR, ResourceType.SINK_CONNECTOR]:
            return options.delete_connectors
        elif resource_type in [ResourceType.KSQLDB_STREAM, ResourceType.KSQLDB_TABLE]:
            return options.delete_ksqldb_resources
        elif resource_type == ResourceType.KAFKA_TOPIC:
            return options.delete_kafka_topics
        elif resource_type in [ResourceType.CLICKHOUSE_TABLE, ResourceType.CLICKHOUSE_DATABASE]:
            return options.delete_destination_data
        elif resource_type == ResourceType.ALERT_RULE:
            return options.delete_alert_rules
        elif resource_type in [ResourceType.DEBEZIUM_SLOT, ResourceType.DEBEZIUM_PUBLICATION]:
            return options.cleanup_debezium
        return True

    async def _delete_connector(self, connector_name: str):
        """Delete a Kafka Connect connector"""
        await self._connector_service.delete_connector(connector_name)

    async def _delete_ksqldb_stream(self, stream_name: str):
        """Delete a ksqlDB stream"""
        await self._ksqldb_service.drop_stream(stream_name, delete_topic=False)

    async def _delete_ksqldb_table(self, table_name: str):
        """Delete a ksqlDB table"""
        await self._ksqldb_service.drop_table(table_name, delete_topic=False)

    async def _delete_kafka_topic(self, topic_name: str):
        """Delete a Kafka topic"""
        await self._kafka_service.delete_topic(topic_name)

    async def _delete_clickhouse_table(self, table_name: str, metadata: Dict):
        """Delete a ClickHouse table"""
        database = metadata.get('database', 'dataflow')
        await self._clickhouse_service.drop_table(database, table_name)

    async def _delete_alert_rule(self, rule_id: str):
        """Delete an alert rule"""
        # Would use alert service when implemented
        logger.info(f"[CLEANUP] Would delete alert rule: {rule_id}")

    async def _delete_debezium_slot(self, slot_name: str, metadata: Dict):
        """Delete a PostgreSQL replication slot"""
        # Would use credential service to connect and drop slot
        logger.info(f"[CLEANUP] Would delete replication slot: {slot_name}")

    async def _delete_debezium_publication(self, publication_name: str, metadata: Dict):
        """Delete a PostgreSQL publication"""
        # Would use credential service to connect and drop publication
        logger.info(f"[CLEANUP] Would delete publication: {publication_name}")

    def _calculate_cost_savings(self, resources: List[TrackedResource]) -> Dict:
        """
        Calculate estimated cost savings from cleaning up resources.

        Uses approximate Confluent Cloud pricing.
        """
        # Approximate pricing
        PRICING = {
            ResourceType.SOURCE_CONNECTOR: 0.24,    # $/day per connector
            ResourceType.SINK_CONNECTOR: 0.24,      # $/day per connector
            ResourceType.KSQLDB_STREAM: 0.10,       # $/day per stream (CSU fraction)
            ResourceType.KSQLDB_TABLE: 0.10,        # $/day per table (CSU fraction)
            ResourceType.KAFKA_TOPIC: 0.05,         # $/day per topic (storage)
            ResourceType.CLICKHOUSE_TABLE: 0.02,    # $/day per table (storage)
        }

        daily_savings = 0.0
        breakdown = {}

        for resource in resources:
            if resource.resource_type in PRICING:
                cost = PRICING[resource.resource_type]
                daily_savings += cost
                type_key = resource.resource_type.value
                breakdown[type_key] = breakdown.get(type_key, 0) + cost

        return {
            "daily": round(daily_savings, 2),
            "monthly": round(daily_savings * 30, 2),
            "yearly": round(daily_savings * 365, 2),
            "breakdown": {k: round(v, 2) for k, v in breakdown.items()}
        }

    async def preview_cleanup(
        self,
        pipeline_id: str
    ) -> Dict:
        """
        Preview what would be cleaned up without actually deleting.

        Returns:
            Dict with resources to be cleaned and estimated cost savings
        """
        resources = resource_tracker.get_deletion_order(pipeline_id)

        if not resources:
            return {
                "pipeline_id": pipeline_id,
                "resources": [],
                "total": 0,
                "cost_savings": {"daily": 0, "monthly": 0}
            }

        resource_list = []
        for r in resources:
            resource_list.append({
                "resource_id": r.resource_id,
                "resource_type": r.resource_type.value,
                "resource_name": r.resource_name,
                "status": r.status.value,
                "can_delete": r.status == ResourceStatus.ACTIVE
            })

        cost_savings = self._calculate_cost_savings(resources)

        return {
            "pipeline_id": pipeline_id,
            "resources": resource_list,
            "total": len(resources),
            "cost_savings": cost_savings,
            "deletion_order": [
                f"{r.resource_type.value}: {r.resource_id}"
                for r in resources
            ]
        }


# Singleton instance
cleanup_service = CleanupService()
