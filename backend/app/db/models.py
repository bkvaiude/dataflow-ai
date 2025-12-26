"""
Database Models for DataFlow AI
"""

from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Integer, Boolean, Index, LargeBinary, BigInteger
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


def to_iso_utc(dt: datetime) -> str | None:
    """Convert datetime to ISO format with Z suffix for UTC timezone indication."""
    if dt is None:
        return None
    return dt.isoformat() + 'Z'


class User(Base):
    """User model - stores authenticated users"""
    __tablename__ = "users"

    id = Column(String(255), primary_key=True)  # Firebase UID or OAuth ID
    email = Column(String(255), unique=True, nullable=True)
    name = Column(String(255), nullable=True)
    picture = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    connectors = relationship("Connector", back_populates="user", cascade="all, delete-orphan")
    credentials = relationship("Credential", back_populates="user", cascade="all, delete-orphan")
    pipeline_templates = relationship("PipelineTemplate", back_populates="user", cascade="all, delete-orphan")
    pipelines = relationship("Pipeline", back_populates="user", cascade="all, delete-orphan")
    enrichments = relationship("EnrichmentConfig", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "picture": self.picture,
            "created_at": to_iso_utc(self.created_at),
            "updated_at": to_iso_utc(self.updated_at),
        }


class Connector(Base):
    """Connector model - stores OAuth tokens for data sources"""
    __tablename__ = "connectors"

    id = Column(String(255), primary_key=True)  # user_id:provider format
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)  # google_ads, facebook_ads, etc.
    tokens = Column(JSON, nullable=False)  # access_token, refresh_token, expires_in, etc.
    connected_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="connectors")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "provider": self.provider,
            "tokens": self.tokens,
            "connected_at": to_iso_utc(self.connected_at),
            "updated_at": to_iso_utc(self.updated_at),
        }


class ProcessingHistory(Base):
    """Tracks data processing history for deduplication"""
    __tablename__ = "processing_history"

    id = Column(String(255), primary_key=True)  # data_hash
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    connector_id = Column(String(50), nullable=False)  # e.g., "google_ads"
    customer_id = Column(String(100), nullable=True)  # Google Ads customer ID
    date_range = Column(String(100), nullable=True)  # e.g., "last_30_days"
    campaigns_count = Column(Integer, nullable=False, default=0)
    processed_at = Column(DateTime, default=datetime.utcnow, index=True)
    batch_id = Column(String(255), nullable=True)  # Unique identifier for this processing batch
    reprocessed = Column(Boolean, default=False)  # Whether this was a forced reprocess
    metadata_json = Column(JSON, nullable=True)  # Additional metadata

    # Index for fast lookups
    __table_args__ = (
        Index('idx_processing_lookup', 'user_id', 'connector_id', 'processed_at'),
    )

    # Relationship
    user = relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "connector_id": self.connector_id,
            "customer_id": self.customer_id,
            "date_range": self.date_range,
            "campaigns_count": self.campaigns_count,
            "processed_at": to_iso_utc(self.processed_at),
            "batch_id": self.batch_id,
            "reprocessed": self.reprocessed,
        }


class Credential(Base):
    """Encrypted database credentials for CDC sources"""
    __tablename__ = "credentials"

    id = Column(String(255), primary_key=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False)  # postgresql, mysql
    encrypted_credentials = Column(LargeBinary, nullable=False)
    encryption_iv = Column(LargeBinary, nullable=False)
    encryption_tag = Column(LargeBinary, nullable=False)
    host = Column(String(255), nullable=True)  # Display only
    database = Column(String(255), nullable=True)
    port = Column(Integer, nullable=True)
    is_valid = Column(Boolean, default=False)
    last_validated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="credentials")
    discovered_schemas = relationship("DiscoveredSchema", back_populates="credential", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "source_type": self.source_type,
            "host": self.host,
            "database": self.database,
            "port": self.port,
            "is_valid": self.is_valid,
            "last_validated_at": to_iso_utc(self.last_validated_at),
            "created_at": to_iso_utc(self.created_at),
        }


class DiscoveredSchema(Base):
    """Stores discovered database schema metadata"""
    __tablename__ = "discovered_schemas"

    id = Column(String(255), primary_key=True)
    credential_id = Column(String(255), ForeignKey("credentials.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    schema_name = Column(String(255), nullable=False)
    table_name = Column(String(255), nullable=False)
    columns = Column(JSON, nullable=False)
    primary_keys = Column(JSON, nullable=True)
    foreign_keys = Column(JSON, nullable=True)
    row_count_estimate = Column(BigInteger, nullable=True)
    has_primary_key = Column(Boolean, default=False)
    cdc_eligible = Column(Boolean, default=False)
    cdc_issues = Column(JSON, nullable=True)
    discovered_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    credential = relationship("Credential", back_populates="discovered_schemas")
    user = relationship("User")

    __table_args__ = (
        Index('idx_schema_table', 'credential_id', 'schema_name', 'table_name', unique=True),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "credential_id": self.credential_id,
            "schema_name": self.schema_name,
            "table_name": self.table_name,
            "columns": self.columns,
            "primary_keys": self.primary_keys,
            "foreign_keys": self.foreign_keys,
            "row_count_estimate": self.row_count_estimate,
            "has_primary_key": self.has_primary_key,
            "cdc_eligible": self.cdc_eligible,
            "cdc_issues": self.cdc_issues,
            "discovered_at": to_iso_utc(self.discovered_at),
        }


class PipelineTemplate(Base):
    """Pipeline templates for transformation workflows"""
    __tablename__ = "pipeline_templates"

    id = Column(String(255), primary_key=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    transforms = Column(JSON, nullable=False)  # List of transform configs
    anomaly_config = Column(JSON, nullable=False)  # Threshold settings
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="pipeline_templates")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "transforms": self.transforms,
            "anomaly_config": self.anomaly_config,
            "is_default": self.is_default,
            "created_at": to_iso_utc(self.created_at),
            "updated_at": to_iso_utc(self.updated_at),
        }


class Pipeline(Base):
    """CDC Pipeline configuration and state"""
    __tablename__ = "pipelines"

    id = Column(String(255), primary_key=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Source configuration
    source_credential_id = Column(String(255), ForeignKey("credentials.id"), nullable=False)
    source_tables = Column(JSON, nullable=False)  # ["public.users", "public.orders"]
    source_connector_name = Column(String(255), nullable=True)

    # Sink configuration
    sink_type = Column(String(50), nullable=False)  # 'clickhouse', 'kafka', 's3'
    sink_config = Column(JSON, nullable=False)  # Connection details and settings
    sink_connector_name = Column(String(255), nullable=True)

    # Transform template (optional)
    template_id = Column(String(255), ForeignKey("pipeline_templates.id", ondelete="SET NULL"), nullable=True)

    # Status tracking
    status = Column(String(50), default="pending")  # pending, running, paused, failed, stopped
    last_health_check = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    # Metrics cache
    metrics_cache = Column(JSON, nullable=True)
    metrics_updated_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    stopped_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="pipelines")
    source_credential = relationship("Credential")
    template = relationship("PipelineTemplate")
    events = relationship("PipelineEvent", back_populates="pipeline", cascade="all, delete-orphan")
    enrichments = relationship("EnrichmentConfig", back_populates="pipeline", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "source_credential_id": self.source_credential_id,
            "source_tables": self.source_tables,
            "source_connector_name": self.source_connector_name,
            "sink_type": self.sink_type,
            "sink_config": self.sink_config,
            "sink_connector_name": self.sink_connector_name,
            "template_id": self.template_id,
            "status": self.status,
            "last_health_check": to_iso_utc(self.last_health_check),
            "error_message": self.error_message,
            "created_at": to_iso_utc(self.created_at),
            "updated_at": to_iso_utc(self.updated_at),
            "started_at": to_iso_utc(self.started_at),
            "stopped_at": to_iso_utc(self.stopped_at),
        }


class PipelineEvent(Base):
    """Pipeline event log for tracking state changes and errors"""
    __tablename__ = "pipeline_events"

    id = Column(String(255), primary_key=True)
    pipeline_id = Column(String(255), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # created, started, paused, resumed, stopped, failed, error
    message = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    pipeline = relationship("Pipeline", back_populates="events")

    __table_args__ = (
        Index('idx_pipeline_events_lookup', 'pipeline_id', 'created_at'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "pipeline_id": self.pipeline_id,
            "event_type": self.event_type,
            "message": self.message,
            "details": self.details,
            "created_at": to_iso_utc(self.created_at),
        }


class EnrichmentConfig(Base):
    """Configuration for stream-table JOIN enrichments in ksqlDB."""
    __tablename__ = "enrichment_configs"

    id = Column(String(255), primary_key=True)
    pipeline_id = Column(String(255), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Enrichment name
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Source Stream
    source_stream_name = Column(String(255), nullable=False)  # ksqlDB stream name
    source_topic = Column(String(255), nullable=False)        # Kafka topic

    # Lookup Tables (JSON array)
    lookup_tables = Column(JSON, nullable=False)  # [{"topic": "...", "key": "...", "alias": "...", "ksqldb_table": "..."}]

    # Join Configuration
    join_type = Column(String(50), default="LEFT")  # LEFT, INNER
    join_keys = Column(JSON, nullable=False)    # [{"stream_column": "user_id", "table_column": "id"}]
    output_columns = Column(JSON, nullable=False)  # ["stream.col1", "table.col2"]

    # Output
    output_stream_name = Column(String(255), nullable=False)  # ksqlDB output stream
    output_topic = Column(String(255), nullable=False)        # Kafka output topic

    # ksqlDB Query ID (for management)
    ksqldb_query_id = Column(String(255), nullable=True)

    # Status
    status = Column(String(50), default="pending")  # pending, active, failed, stopped

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    activated_at = Column(DateTime, nullable=True)

    # Relationships
    pipeline = relationship("Pipeline", back_populates="enrichments")
    user = relationship("User", back_populates="enrichments")

    def to_dict(self):
        return {
            "id": self.id,
            "pipeline_id": self.pipeline_id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "source_stream_name": self.source_stream_name,
            "source_topic": self.source_topic,
            "lookup_tables": self.lookup_tables,
            "join_type": self.join_type,
            "join_keys": self.join_keys,
            "output_columns": self.output_columns,
            "output_stream_name": self.output_stream_name,
            "output_topic": self.output_topic,
            "ksqldb_query_id": self.ksqldb_query_id,
            "status": self.status,
            "created_at": to_iso_utc(self.created_at),
            "updated_at": to_iso_utc(self.updated_at),
            "activated_at": to_iso_utc(self.activated_at),
        }


class AlertRule(Base):
    """Alert rules for pipeline anomaly notifications"""
    __tablename__ = "alert_rules"

    id = Column(String(255), primary_key=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pipeline_id = Column(String(255), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    rule_type = Column(String(50), nullable=False)  # volume_spike, volume_drop, gap_detection, null_ratio
    threshold_config = Column(JSON, nullable=False)  # Detection thresholds
    enabled_days = Column(JSON, default=[4])  # [4] = Friday only (0=Mon, 6=Sun)
    enabled_hours = Column(JSON, nullable=True)  # Optional hour restrictions [9, 10, 11, ...]
    cooldown_minutes = Column(Integer, default=30)
    severity = Column(String(20), default="warning")  # info, warning, critical
    recipients = Column(JSON, nullable=True)  # Email recipients
    is_active = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime, nullable=True)
    trigger_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")
    pipeline = relationship("Pipeline")
    history = relationship("AlertHistory", back_populates="rule", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_alert_rules_user_pipeline', 'user_id', 'pipeline_id'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "pipeline_id": self.pipeline_id,
            "name": self.name,
            "description": self.description,
            "rule_type": self.rule_type,
            "threshold_config": self.threshold_config,
            "enabled_days": self.enabled_days,
            "enabled_hours": self.enabled_hours,
            "cooldown_minutes": self.cooldown_minutes,
            "severity": self.severity,
            "recipients": self.recipients,
            "is_active": self.is_active,
            "last_triggered_at": to_iso_utc(self.last_triggered_at),
            "trigger_count": self.trigger_count,
            "created_at": to_iso_utc(self.created_at),
            "updated_at": to_iso_utc(self.updated_at),
        }


class AlertHistory(Base):
    """History of triggered alerts"""
    __tablename__ = "alert_history"

    id = Column(String(255), primary_key=True)
    rule_id = Column(String(255), ForeignKey("alert_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False)  # Matches rule_type
    severity = Column(String(20), nullable=False)
    title = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)  # Anomaly details
    email_sent = Column(Boolean, default=False)
    email_sent_at = Column(DateTime, nullable=True)
    email_recipients = Column(JSON, nullable=True)
    email_error = Column(Text, nullable=True)
    triggered_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    rule = relationship("AlertRule", back_populates="history")

    __table_args__ = (
        Index('idx_alert_history_rule_time', 'rule_id', 'triggered_at'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "rule_id": self.rule_id,
            "alert_type": self.alert_type,
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
            "details": self.details,
            "email_sent": self.email_sent,
            "email_sent_at": to_iso_utc(self.email_sent_at),
            "email_recipients": self.email_recipients,
            "email_error": self.email_error,
            "triggered_at": to_iso_utc(self.triggered_at),
        }
