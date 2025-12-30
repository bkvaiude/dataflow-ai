"""
Authentication Dependencies
Shared authentication dependencies for FastAPI routes.
Supports both JWT tokens and legacy session-based auth.
"""

from typing import Optional
from fastapi import HTTPException, Query, Header
from app.api.auth import get_session
from app.utils.jwt_utils import verify_access_token


async def get_current_user_id(
    authorization: Optional[str] = Header(None),
    session: Optional[str] = Query(None)
) -> str:
    """
    Get current authenticated user ID from JWT token or legacy session.

    Priority:
    1. JWT Bearer token from Authorization header (preferred)
    2. Legacy session token from query parameter (backward compatibility)

    Args:
        authorization: Authorization header with Bearer token
        session: Legacy session ID from query parameter

    Returns:
        User ID string

    Raises:
        HTTPException: 401 if not authenticated or token invalid
    """

    # Try JWT authentication first (preferred method)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        payload = verify_access_token(token)

        if payload:
            user_id = payload.get("sub")
            if user_id:
                return user_id

        # JWT verification failed - try token as session ID (for backward compatibility)
        user_data = get_session(token)
        if user_data and user_data.get("id"):
            return user_data["id"]

        # Token exists but is invalid
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token"
        )

    # Fallback to legacy session authentication via query param
    if session:
        user_data = get_session(session)
        if user_data and user_data.get("id"):
            return user_data["id"]

        raise HTTPException(
            status_code=401,
            detail="Session expired"
        )

    # No authentication provided
    raise HTTPException(
        status_code=401,
        detail="Not authenticated. Provide Authorization header with Bearer token or session parameter."
    )
