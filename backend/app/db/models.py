"""
Database Models for DataFlow AI
"""

from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Integer, Boolean, Index, LargeBinary, BigInteger
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


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

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "picture": self.picture,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
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
            "connected_at": self.connected_at.isoformat() if self.connected_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
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
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
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
            "last_validated_at": self.last_validated_at.isoformat() if self.last_validated_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
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
            "discovered_at": self.discovered_at.isoformat() if self.discovered_at else None,
        }
