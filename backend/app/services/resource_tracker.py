"""
Resource Tracker Service

Tracks all resources created for a pipeline to enable complete cleanup.
This is critical for the "no cost wastage" principle of DataFlow AI.

Resources tracked:
- Kafka topics (raw + filtered)
- ksqlDB streams and tables
- Connectors (source + sink)
- Destination tables (ClickHouse, etc.)
- Alert rules
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)


class ResourceType(str, Enum):
    """Types of resources that can be tracked"""
    KAFKA_TOPIC = "kafka_topic"
    KSQLDB_STREAM = "ksqldb_stream"
    KSQLDB_TABLE = "ksqldb_table"
    SOURCE_CONNECTOR = "source_connector"
    SINK_CONNECTOR = "sink_connector"
    CLICKHOUSE_TABLE = "clickhouse_table"
    CLICKHOUSE_DATABASE = "clickhouse_database"
    ALERT_RULE = "alert_rule"
    DEBEZIUM_SLOT = "debezium_slot"
    DEBEZIUM_PUBLICATION = "debezium_publication"


class ResourceStatus(str, Enum):
    """Status of a tracked resource"""
    PENDING = "pending"        # Planned but not yet created
    CREATING = "creating"      # Currently being created
    ACTIVE = "active"          # Successfully created and running
    FAILED = "failed"          # Creation failed
    DELETING = "deleting"      # Currently being deleted
    DELETED = "deleted"        # Successfully deleted
    ORPHANED = "orphaned"      # Lost reference, needs manual cleanup


@dataclass
class TrackedResource:
    """A single tracked resource"""
    resource_type: ResourceType
    resource_id: str           # Unique identifier (e.g., topic name, connector name)
    resource_name: str         # Human-readable name
    pipeline_id: str           # Associated pipeline
    status: ResourceStatus = ResourceStatus.PENDING
    metadata: Dict = field(default_factory=dict)  # Additional info (e.g., partitions, schema)
    created_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    error_message: Optional[str] = None
    depends_on: List[str] = field(default_factory=list)  # Resource IDs this depends on

    def to_dict(self) -> Dict:
        return {
            "resource_type": self.resource_type.value,
            "resource_id": self.resource_id,
            "resource_name": self.resource_name,
            "pipeline_id": self.pipeline_id,
            "status": self.status.value,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "error_message": self.error_message,
            "depends_on": self.depends_on
        }


@dataclass
class PipelineResources:
    """All resources for a single pipeline"""
    pipeline_id: str
    user_id: str
    resources: Dict[str, TrackedResource] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def add_resource(
        self,
        resource_type: ResourceType,
        resource_id: str,
        resource_name: str,
        metadata: Optional[Dict] = None,
        depends_on: Optional[List[str]] = None
    ) -> TrackedResource:
        """Add a new resource to track"""
        resource = TrackedResource(
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            pipeline_id=self.pipeline_id,
            metadata=metadata or {},
            depends_on=depends_on or []
        )
        self.resources[resource_id] = resource
        self.updated_at = datetime.utcnow()
        return resource

    def update_status(
        self,
        resource_id: str,
        status: ResourceStatus,
        error_message: Optional[str] = None
    ):
        """Update resource status"""
        if resource_id in self.resources:
            resource = self.resources[resource_id]
            resource.status = status
            resource.error_message = error_message

            if status == ResourceStatus.ACTIVE:
                resource.created_at = datetime.utcnow()
            elif status == ResourceStatus.DELETED:
                resource.deleted_at = datetime.utcnow()

            self.updated_at = datetime.utcnow()

    def get_by_type(self, resource_type: ResourceType) -> List[TrackedResource]:
        """Get all resources of a specific type"""
        return [r for r in self.resources.values() if r.resource_type == resource_type]

    def get_active(self) -> List[TrackedResource]:
        """Get all active resources"""
        return [r for r in self.resources.values() if r.status == ResourceStatus.ACTIVE]

    def get_failed(self) -> List[TrackedResource]:
        """Get all failed resources"""
        return [r for r in self.resources.values() if r.status == ResourceStatus.FAILED]

    def get_deletion_order(self) -> List[TrackedResource]:
        """
        Get resources in the correct order for deletion.
        Dependencies must be deleted AFTER their dependents.

        Order:
        1. Sink connectors (depends on topics)
        2. Alert rules (depends on pipelines)
        3. ksqlDB streams/tables (depends on topics)
        4. Source connectors (depends on topics)
        5. Kafka topics (base resource)
        6. Destination tables (independent)
        7. Debezium slots/publications (cleanup)
        """
        deletion_order = [
            ResourceType.SINK_CONNECTOR,
            ResourceType.ALERT_RULE,
            ResourceType.KSQLDB_TABLE,
            ResourceType.KSQLDB_STREAM,
            ResourceType.SOURCE_CONNECTOR,
            ResourceType.KAFKA_TOPIC,
            ResourceType.CLICKHOUSE_TABLE,
            ResourceType.CLICKHOUSE_DATABASE,
            ResourceType.DEBEZIUM_SLOT,
            ResourceType.DEBEZIUM_PUBLICATION,
        ]

        ordered = []
        for resource_type in deletion_order:
            resources = self.get_by_type(resource_type)
            # Sort by dependencies - resources with more dependencies first
            resources.sort(key=lambda r: len(r.depends_on), reverse=True)
            ordered.extend(resources)

        return ordered

    def to_dict(self) -> Dict:
        return {
            "pipeline_id": self.pipeline_id,
            "user_id": self.user_id,
            "resources": {k: v.to_dict() for k, v in self.resources.items()},
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "summary": {
                "total": len(self.resources),
                "active": len(self.get_active()),
                "failed": len(self.get_failed()),
                "by_type": {
                    rt.value: len(self.get_by_type(rt))
                    for rt in ResourceType
                    if self.get_by_type(rt)
                }
            }
        }


class ResourceTracker:
    """
    Service for tracking pipeline resources across their lifecycle.

    This enables:
    - Complete cleanup when deleting pipelines
    - Cost tracking (resources = cost)
    - Dependency management
    - Orphan detection
    """

    def __init__(self):
        # In-memory storage (would be DB in production)
        self._pipelines: Dict[str, PipelineResources] = {}

    def create_pipeline_tracker(
        self,
        pipeline_id: str,
        user_id: str
    ) -> PipelineResources:
        """Create a new resource tracker for a pipeline"""
        tracker = PipelineResources(
            pipeline_id=pipeline_id,
            user_id=user_id
        )
        self._pipelines[pipeline_id] = tracker
        logger.info(f"[RESOURCE_TRACKER] Created tracker for pipeline: {pipeline_id}")
        return tracker

    def get_pipeline_resources(self, pipeline_id: str) -> Optional[PipelineResources]:
        """Get resource tracker for a pipeline"""
        return self._pipelines.get(pipeline_id)

    def track_resource(
        self,
        pipeline_id: str,
        resource_type: ResourceType,
        resource_id: str,
        resource_name: str,
        metadata: Optional[Dict] = None,
        depends_on: Optional[List[str]] = None
    ) -> Optional[TrackedResource]:
        """
        Track a new resource for a pipeline.

        Args:
            pipeline_id: Pipeline this resource belongs to
            resource_type: Type of resource
            resource_id: Unique identifier
            resource_name: Human-readable name
            metadata: Additional information
            depends_on: List of resource IDs this depends on

        Returns:
            TrackedResource or None if pipeline not found
        """
        tracker = self._pipelines.get(pipeline_id)
        if not tracker:
            logger.warning(f"[RESOURCE_TRACKER] Pipeline not found: {pipeline_id}")
            return None

        resource = tracker.add_resource(
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            metadata=metadata,
            depends_on=depends_on
        )

        logger.info(
            f"[RESOURCE_TRACKER] Tracked {resource_type.value}: {resource_id} "
            f"for pipeline {pipeline_id}"
        )
        return resource

    def mark_created(self, pipeline_id: str, resource_id: str):
        """Mark a resource as successfully created"""
        tracker = self._pipelines.get(pipeline_id)
        if tracker:
            tracker.update_status(resource_id, ResourceStatus.ACTIVE)
            logger.info(f"[RESOURCE_TRACKER] Marked active: {resource_id}")

    def mark_failed(self, pipeline_id: str, resource_id: str, error: str):
        """Mark a resource as failed"""
        tracker = self._pipelines.get(pipeline_id)
        if tracker:
            tracker.update_status(resource_id, ResourceStatus.FAILED, error)
            logger.warning(f"[RESOURCE_TRACKER] Marked failed: {resource_id} - {error}")

    def mark_deleted(self, pipeline_id: str, resource_id: str):
        """Mark a resource as deleted"""
        tracker = self._pipelines.get(pipeline_id)
        if tracker:
            tracker.update_status(resource_id, ResourceStatus.DELETED)
            logger.info(f"[RESOURCE_TRACKER] Marked deleted: {resource_id}")

    def get_deletion_order(self, pipeline_id: str) -> List[TrackedResource]:
        """Get resources in the correct order for cleanup"""
        tracker = self._pipelines.get(pipeline_id)
        if not tracker:
            return []

        # Only return active resources
        return [
            r for r in tracker.get_deletion_order()
            if r.status == ResourceStatus.ACTIVE
        ]

    def get_cost_relevant_resources(self, pipeline_id: str) -> Dict[str, List[TrackedResource]]:
        """
        Get resources grouped by cost category.

        Returns:
            Dict with 'connectors', 'topics', 'processing', 'storage' keys
        """
        tracker = self._pipelines.get(pipeline_id)
        if not tracker:
            return {}

        return {
            'connectors': [
                r for r in tracker.get_active()
                if r.resource_type in [ResourceType.SOURCE_CONNECTOR, ResourceType.SINK_CONNECTOR]
            ],
            'topics': [
                r for r in tracker.get_active()
                if r.resource_type == ResourceType.KAFKA_TOPIC
            ],
            'processing': [
                r for r in tracker.get_active()
                if r.resource_type in [ResourceType.KSQLDB_STREAM, ResourceType.KSQLDB_TABLE]
            ],
            'storage': [
                r for r in tracker.get_active()
                if r.resource_type in [ResourceType.CLICKHOUSE_TABLE, ResourceType.CLICKHOUSE_DATABASE]
            ]
        }

    def list_all_pipelines(self, user_id: Optional[str] = None) -> List[PipelineResources]:
        """List all tracked pipelines, optionally filtered by user"""
        if user_id:
            return [p for p in self._pipelines.values() if p.user_id == user_id]
        return list(self._pipelines.values())

    def cleanup_deleted_pipeline(self, pipeline_id: str):
        """Remove a pipeline from tracking after cleanup is complete"""
        if pipeline_id in self._pipelines:
            del self._pipelines[pipeline_id]
            logger.info(f"[RESOURCE_TRACKER] Removed pipeline tracker: {pipeline_id}")

    def to_dict(self, pipeline_id: str) -> Optional[Dict]:
        """Get pipeline resources as dictionary"""
        tracker = self._pipelines.get(pipeline_id)
        if tracker:
            return tracker.to_dict()
        return None


# Singleton instance
resource_tracker = ResourceTracker()
