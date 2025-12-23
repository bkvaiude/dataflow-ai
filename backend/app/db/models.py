"""
Database Models for DataFlow AI
"""

from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
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
