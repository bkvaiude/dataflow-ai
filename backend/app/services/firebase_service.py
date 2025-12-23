"""
Firebase Service - DEPRECATED
This module now uses PostgreSQL via db_service.
Kept for backward compatibility with existing imports.
"""

from app.services.db_service import db_service

# Re-export db_service as firebase_service for backward compatibility
firebase_service = db_service

# Also export the class for type hints
FirebaseService = type(db_service)
