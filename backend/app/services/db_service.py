"""
Database Service
Handles PostgreSQL operations for user data and connector tokens.
Falls back to in-memory storage if database is unavailable.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime


class InMemoryStore:
    """In-memory fallback when database is unavailable"""

    def __init__(self):
        self.users: Dict[str, Dict] = {}
        self.connectors: Dict[str, Dict] = {}
        print("InMemoryStore initialized (database unavailable)")

    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        return self.users.get(user_id)

    def create_user(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        self.users[user_id] = {
            "id": user_id,
            **data,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        return self.users[user_id]

    def delete_user(self, user_id: str) -> bool:
        if user_id in self.users:
            del self.users[user_id]
            # Also delete user's connectors
            to_delete = [k for k in self.connectors if k.startswith(f"{user_id}:")]
            for k in to_delete:
                del self.connectors[k]
            return True
        return False

    def save_connector(self, user_id: str, provider: str, tokens: Dict[str, Any]) -> Dict[str, Any]:
        key = f"{user_id}:{provider}"
        self.connectors[key] = {
            "id": key,
            "user_id": user_id,
            "provider": provider,
            "tokens": tokens,
            "connected_at": datetime.utcnow().isoformat(),
        }
        print(f"[MEMORY] Saved connector {provider} for user {user_id}")
        return self.connectors[key]

    def get_connector(self, user_id: str, provider: str) -> Optional[Dict[str, Any]]:
        return self.connectors.get(f"{user_id}:{provider}")

    def delete_connector(self, user_id: str, provider: str) -> bool:
        key = f"{user_id}:{provider}"
        if key in self.connectors:
            del self.connectors[key]
            return True
        return False

    def list_user_connectors(self, user_id: str) -> List[Dict[str, Any]]:
        return [c for k, c in self.connectors.items() if k.startswith(f"{user_id}:")]


class DatabaseService:
    """
    Database Service for users and connectors.
    Uses PostgreSQL via SQLAlchemy, falls back to in-memory if unavailable.
    """

    def __init__(self):
        self.is_mock = False
        self._store = None
        self._engine = None
        self._SessionLocal = None

        try:
            self._init_database()
        except Exception as e:
            print(f"Database unavailable, using in-memory storage: {e}")
            self._store = InMemoryStore()
            self.is_mock = True

    def _init_database(self):
        """Initialize SQLAlchemy connection"""
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from app.config import settings
        from app.db.models import Base

        self._engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )

        # Test connection
        with self._engine.connect() as conn:
            conn.execute("SELECT 1")

        self._SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self._engine)

        # Create tables
        Base.metadata.create_all(bind=self._engine)
        print("DatabaseService initialized (PostgreSQL)")

    def _get_session(self):
        """Get a new database session"""
        if self._SessionLocal:
            return self._SessionLocal()
        return None

    # ==================== User Operations ====================

    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        if self.is_mock:
            return self._store.get_user(user_id)

        from app.db.models import User
        with self._get_session() as session:
            user = session.query(User).filter(User.id == user_id).first()
            return user.to_dict() if user else None

    def create_user(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update user"""
        if self.is_mock:
            return self._store.create_user(user_id, data)

        from app.db.models import User
        with self._get_session() as session:
            user = session.query(User).filter(User.id == user_id).first()

            if user:
                user.email = data.get("email", user.email)
                user.name = data.get("name", user.name)
                user.picture = data.get("picture", user.picture)
                user.updated_at = datetime.utcnow()
            else:
                user = User(
                    id=user_id,
                    email=data.get("email"),
                    name=data.get("name"),
                    picture=data.get("picture"),
                )
                session.add(user)

            session.commit()
            session.refresh(user)
            return user.to_dict()

    def delete_user(self, user_id: str) -> bool:
        """Delete user and all their connectors"""
        if self.is_mock:
            return self._store.delete_user(user_id)

        from app.db.models import User
        with self._get_session() as session:
            user = session.query(User).filter(User.id == user_id).first()
            if user:
                session.delete(user)
                session.commit()
                return True
            return False

    # ==================== Connector Operations ====================

    def save_connector(
        self, user_id: str, provider: str, tokens: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Save connector tokens for a user"""
        if self.is_mock:
            return self._store.save_connector(user_id, provider, tokens)

        from app.db.models import User, Connector
        connector_id = f"{user_id}:{provider}"

        with self._get_session() as session:
            # Ensure user exists
            user = session.query(User).filter(User.id == user_id).first()
            if not user:
                user = User(id=user_id)
                session.add(user)
                session.flush()

            # Check for existing connector
            connector = session.query(Connector).filter(Connector.id == connector_id).first()

            if connector:
                connector.tokens = tokens
                connector.updated_at = datetime.utcnow()
            else:
                connector = Connector(
                    id=connector_id,
                    user_id=user_id,
                    provider=provider,
                    tokens=tokens,
                )
                session.add(connector)

            session.commit()
            session.refresh(connector)

            print(f"[DB] Saved connector {provider} for user {user_id}")
            return connector.to_dict()

    def get_connector(
        self, user_id: str, provider: str
    ) -> Optional[Dict[str, Any]]:
        """Get connector tokens for a user"""
        if self.is_mock:
            return self._store.get_connector(user_id, provider)

        from app.db.models import Connector
        connector_id = f"{user_id}:{provider}"

        with self._get_session() as session:
            connector = session.query(Connector).filter(Connector.id == connector_id).first()
            return connector.to_dict() if connector else None

    def delete_connector(self, user_id: str, provider: str) -> bool:
        """Delete connector for a user"""
        if self.is_mock:
            return self._store.delete_connector(user_id, provider)

        from app.db.models import Connector
        connector_id = f"{user_id}:{provider}"

        with self._get_session() as session:
            connector = session.query(Connector).filter(Connector.id == connector_id).first()
            if connector:
                session.delete(connector)
                session.commit()
                return True
            return False

    def list_user_connectors(self, user_id: str) -> List[Dict[str, Any]]:
        """List all connectors for a user"""
        if self.is_mock:
            return self._store.list_user_connectors(user_id)

        from app.db.models import Connector
        with self._get_session() as session:
            connectors = session.query(Connector).filter(Connector.user_id == user_id).all()
            return [c.to_dict() for c in connectors]


# Singleton instance
db_service = DatabaseService()
