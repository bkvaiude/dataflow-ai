"""
JWT Token Utilities
Handles creation and validation of JWT access and refresh tokens.
"""

import jwt
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from app.config import settings
from app.db.database import get_db
from app.db.models import RefreshToken


def create_access_token(user_id: str, user_email: str) -> str:
    """
    Create a JWT access token with 1 hour expiration.

    Args:
        user_id: User's unique ID
        user_email: User's email address

    Returns:
        Encoded JWT token string
    """
    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

    payload = {
        "sub": user_id,  # Subject (user ID)
        "email": user_email,
        "type": "access",
        "iat": now,  # Issued at
        "exp": expires_at,  # Expiration
    }

    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> tuple[str, str]:
    """
    Create a JWT refresh token with 7 days expiration.
    Stores token hash in database for revocation capability.

    Args:
        user_id: User's unique ID

    Returns:
        Tuple of (token string, token_id/jti)
    """
    now = datetime.utcnow()
    expires_at = now + timedelta(days=settings.jwt_refresh_token_expire_days)

    # Generate unique token ID
    token_id = secrets.token_urlsafe(32)

    payload = {
        "sub": user_id,
        "type": "refresh",
        "jti": token_id,  # JWT ID for revocation
        "iat": now,
        "exp": expires_at,
    }

    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    # Store token hash in database
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    db = next(get_db())
    try:
        refresh_token_record = RefreshToken(
            id=token_id,
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(refresh_token_record)
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

    return token, token_id


def verify_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode an access token.

    Args:
        token: JWT token string

    Returns:
        Decoded token payload or None if invalid
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )

        # Verify token type
        if payload.get("type") != "access":
            return None

        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def verify_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode a refresh token.
    Checks if token is revoked in database.

    Args:
        token: JWT token string

    Returns:
        Decoded token payload or None if invalid/revoked
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )

        # Verify token type
        if payload.get("type") != "refresh":
            return None

        # Check if token is revoked
        token_id = payload.get("jti")
        if not token_id:
            return None

        token_hash = hashlib.sha256(token.encode()).hexdigest()

        db = next(get_db())
        try:
            refresh_token_record = db.query(RefreshToken).filter(
                RefreshToken.id == token_id,
                RefreshToken.token_hash == token_hash
            ).first()

            if not refresh_token_record:
                return None

            if refresh_token_record.is_revoked:
                return None

            # Check expiration
            if refresh_token_record.expires_at < datetime.utcnow():
                return None

            return payload
        finally:
            db.close()

    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def revoke_refresh_token(token_id: str) -> bool:
    """
    Revoke a refresh token by its ID.

    Args:
        token_id: Token ID (jti)

    Returns:
        True if revoked, False if not found
    """
    db = next(get_db())
    try:
        refresh_token_record = db.query(RefreshToken).filter(
            RefreshToken.id == token_id
        ).first()

        if not refresh_token_record:
            return False

        refresh_token_record.is_revoked = True
        refresh_token_record.revoked_at = datetime.utcnow()
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False
    finally:
        db.close()


def revoke_all_user_tokens(user_id: str) -> int:
    """
    Revoke all refresh tokens for a user (logout from all devices).

    Args:
        user_id: User's unique ID

    Returns:
        Number of tokens revoked
    """
    db = next(get_db())
    try:
        tokens = db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked == False
        ).all()

        count = 0
        for token in tokens:
            token.is_revoked = True
            token.revoked_at = datetime.utcnow()
            count += 1

        db.commit()
        return count
    except Exception:
        db.rollback()
        return 0
    finally:
        db.close()


def cleanup_expired_tokens() -> int:
    """
    Clean up expired refresh tokens from database.
    Should be run periodically (e.g., daily cron job).

    Returns:
        Number of tokens deleted
    """
    db = next(get_db())
    try:
        result = db.query(RefreshToken).filter(
            RefreshToken.expires_at < datetime.utcnow()
        ).delete()
        db.commit()
        return result
    except Exception:
        db.rollback()
        return 0
    finally:
        db.close()
