"""
Processing Tracker Service
Tracks data processing history for deduplication.
Uses PostgreSQL for storage, falls back to in-memory when database unavailable.
"""

import hashlib
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
import uuid


class InMemoryProcessingCache:
    """In-memory fallback when database is unavailable"""

    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        print("InMemoryProcessingCache initialized (database unavailable)")

    def get(self, data_hash: str) -> Optional[Dict[str, Any]]:
        return self._cache.get(data_hash)

    def set(self, data_hash: str, data: Dict[str, Any]) -> None:
        self._cache[data_hash] = data

    def delete(self, data_hash: str) -> None:
        self._cache.pop(data_hash, None)


class ProcessingTracker:
    """
    Tracks data processing to prevent duplicates.
    Uses PostgreSQL for storage via db_service pattern.
    """

    def __init__(self):
        self._memory_cache = None
        self.is_mock = False
        self._init_tracker()

    def _init_tracker(self):
        """Initialize the tracker, checking database availability"""
        from app.services.db_service import db_service

        if db_service.is_mock:
            self._memory_cache = InMemoryProcessingCache()
            self.is_mock = True
            print("ProcessingTracker: Using in-memory storage (database unavailable)")
        else:
            print("ProcessingTracker: Using PostgreSQL storage")

    def _get_session(self):
        """Get database session from db_service"""
        from app.services.db_service import db_service
        return db_service._get_session()

    def generate_data_hash(
        self,
        user_id: str,
        connector_id: str,
        customer_id: str = "",
        date_range: str = "default"
    ) -> str:
        """Generate unique hash for this data fetch configuration"""
        key_string = f"{user_id}:{connector_id}:{customer_id}:{date_range}"
        return hashlib.sha256(key_string.encode()).hexdigest()[:32]

    def is_already_processed(
        self,
        user_id: str,
        connector_id: str,
        customer_id: str = "",
        date_range: str = "default"
    ) -> Tuple[bool, Optional[datetime], Optional[Dict[str, Any]]]:
        """
        Check if this exact data configuration was already processed.

        Returns:
            Tuple of (is_processed, processed_at, metadata)
        """
        data_hash = self.generate_data_hash(user_id, connector_id, customer_id, date_range)

        # Use in-memory cache if database unavailable
        if self.is_mock:
            cached = self._memory_cache.get(data_hash)
            if cached:
                processed_at = datetime.fromisoformat(cached["processed_at"])
                return True, processed_at, cached
            return False, None, None

        # Use PostgreSQL
        try:
            from app.db.models import ProcessingHistory
            session = self._get_session()
            if not session:
                return False, None, None

            with session:
                record = session.query(ProcessingHistory).filter(
                    ProcessingHistory.id == data_hash
                ).first()

                if record:
                    return True, record.processed_at, record.to_dict()

        except Exception as e:
            print(f"ProcessingTracker: Database lookup error: {e}")

        return False, None, None

    def mark_as_processed(
        self,
        user_id: str,
        connector_id: str,
        customer_id: str = "",
        date_range: str = "default",
        campaigns_count: int = 0,
        batch_id: str = None,
        reprocessed: bool = False,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Mark data configuration as processed.

        Returns:
            The data hash that was stored
        """
        data_hash = self.generate_data_hash(user_id, connector_id, customer_id, date_range)
        batch_id = batch_id or str(uuid.uuid4())[:8]
        now = datetime.utcnow()

        # Use in-memory cache if database unavailable
        if self.is_mock:
            cache_data = {
                "id": data_hash,
                "user_id": user_id,
                "connector_id": connector_id,
                "customer_id": customer_id,
                "date_range": date_range,
                "processed_at": now.isoformat(),
                "campaigns_count": campaigns_count,
                "batch_id": batch_id,
                "reprocessed": reprocessed,
            }
            self._memory_cache.set(data_hash, cache_data)
            print(f"ProcessingTracker: Marked {data_hash[:8]}... as processed (in-memory)")
            return data_hash

        # Use PostgreSQL
        try:
            from app.db.models import ProcessingHistory
            session = self._get_session()
            if not session:
                return data_hash

            with session:
                # Upsert: update if exists, insert if not
                record = session.query(ProcessingHistory).filter(
                    ProcessingHistory.id == data_hash
                ).first()

                if record:
                    record.processed_at = now
                    record.campaigns_count = campaigns_count
                    record.batch_id = batch_id
                    record.reprocessed = reprocessed
                    record.metadata_json = metadata
                else:
                    record = ProcessingHistory(
                        id=data_hash,
                        user_id=user_id,
                        connector_id=connector_id,
                        customer_id=customer_id or None,
                        date_range=date_range,
                        campaigns_count=campaigns_count,
                        processed_at=now,
                        batch_id=batch_id,
                        reprocessed=reprocessed,
                        metadata_json=metadata,
                    )
                    session.add(record)

                session.commit()
                print(f"ProcessingTracker: Marked {data_hash[:8]}... as processed (PostgreSQL)")

        except Exception as e:
            print(f"ProcessingTracker: Failed to store in database: {e}")

        return data_hash

    def get_time_since_processed(self, processed_at: datetime) -> str:
        """Get human-readable time since processing"""
        delta = datetime.utcnow() - processed_at

        if delta.days > 0:
            return f"{delta.days} day{'s' if delta.days > 1 else ''} ago"

        hours = delta.seconds // 3600
        if hours > 0:
            return f"{hours} hour{'s' if hours > 1 else ''} ago"

        minutes = delta.seconds // 60
        if minutes > 0:
            return f"{minutes} minute{'s' if minutes > 1 else ''} ago"

        return "just now"

    def clear_processing_record(
        self,
        user_id: str,
        connector_id: str,
        customer_id: str = "",
        date_range: str = "default"
    ) -> bool:
        """Clear a processing record (useful for testing or manual reset)"""
        data_hash = self.generate_data_hash(user_id, connector_id, customer_id, date_range)

        if self.is_mock:
            self._memory_cache.delete(data_hash)
            return True

        try:
            from app.db.models import ProcessingHistory
            session = self._get_session()
            if not session:
                return False

            with session:
                record = session.query(ProcessingHistory).filter(
                    ProcessingHistory.id == data_hash
                ).first()

                if record:
                    session.delete(record)
                    session.commit()
                    return True
                return False

        except Exception as e:
            print(f"ProcessingTracker: Failed to clear record: {e}")
            return False


# Singleton instance
processing_tracker = ProcessingTracker()
