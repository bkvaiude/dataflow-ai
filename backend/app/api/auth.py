"""
Authentication API Routes
Handles user authentication via Google OAuth with JWT tokens.
"""

import base64
import json
import secrets
import httpx
from fastapi import APIRouter, HTTPException, Query, Response, Header, Depends
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional
from app.config import settings
from app.services.db_service import db_service
from app.utils.jwt_utils import (
    create_access_token,
    create_refresh_token,
    verify_access_token,
    verify_refresh_token,
    revoke_refresh_token,
    revoke_all_user_tokens,
)

router = APIRouter()

# In-memory session store (DEPRECATED - keeping for backward compatibility during migration)
sessions: dict = {}


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    picture: Optional[str]


class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: Optional[UserResponse] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshTokenRequest(BaseModel):
    refresh_token: str


def create_session(user_data: dict) -> str:
    """Create a session token for the user"""
    session_id = secrets.token_urlsafe(32)
    sessions[session_id] = user_data
    return session_id


def get_session(session_id: str) -> Optional[dict]:
    """Get user data from session"""
    return sessions.get(session_id)


def delete_session(session_id: str) -> bool:
    """Delete a session"""
    if session_id in sessions:
        del sessions[session_id]
        return True
    return False


@router.get("/google/login")
async def google_login():
    """
    Initialize Google OAuth login flow.
    Returns the OAuth URL to redirect the user to.
    """
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    # Scopes for user profile + Drive access for dashboards
    scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.file",
    ]
    scope = " ".join(scopes)

    # State for CSRF protection
    state = secrets.token_urlsafe(16)

    # Use auth-specific redirect URI
    redirect_uri = settings.google_auth_redirect_uri

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.google_client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={scope}&"
        f"access_type=offline&"
        f"prompt=consent&"
        f"state={state}"
    )

    return {"auth_url": auth_url, "state": state}


@router.get("/google/callback")
async def google_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None
):
    """
    Handle Google OAuth callback.
    Exchanges code for tokens, fetches user info, creates session.
    """
    # Frontend URL for redirects
    frontend_url = "http://localhost:3000"

    if error:
        return RedirectResponse(url=f"{frontend_url}/?error={error}")

    if not code:
        return RedirectResponse(url=f"{frontend_url}/?error=no_code")


    try:
        # Exchange code for tokens
        redirect_uri = settings.google_auth_redirect_uri
        token_url = "https://oauth2.googleapis.com/token"

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                token_url,
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
            )

            if token_response.status_code != 200:
                error_data = token_response.json()
                return RedirectResponse(
                    url=f"{frontend_url}/?error={error_data.get('error', 'token_exchange_failed')}"
                )

            tokens = token_response.json()

            # Fetch user info
            userinfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )

            if userinfo_response.status_code != 200:
                return RedirectResponse(url=f"{frontend_url}/?error=userinfo_failed")

            userinfo = userinfo_response.json()

        # Create user data with tokens for Sheets/Drive access
        user_data = {
            "id": userinfo["id"],
            "email": userinfo.get("email", ""),
            "name": userinfo.get("name"),
            "picture": userinfo.get("picture"),
            "tokens": {
                "access_token": tokens.get("access_token"),
                "refresh_token": tokens.get("refresh_token"),
                "expires_in": tokens.get("expires_in"),
            }
        }

        # Save user to database
        db_service.create_user(user_data["id"], user_data)

        # Create JWT tokens for application authentication
        access_token = create_access_token(user_data["id"], user_data["email"])
        refresh_token, token_id = create_refresh_token(user_data["id"])

        # Create session (DEPRECATED - for backward compatibility)
        session_id = create_session(user_data)

        # Redirect to frontend with JWT tokens in URL
        # Frontend will extract and store them in localStorage
        return RedirectResponse(
            url=f"{frontend_url}/auth/callback?"
            f"access_token={access_token}&"
            f"refresh_token={refresh_token}&"
            f"session={session_id}"  # Keep for backward compatibility
        )

    except Exception as e:
        print(f"Auth callback error: {e}")
        return RedirectResponse(url=f"{frontend_url}/?error=auth_failed")


@router.get("/status", response_model=AuthStatusResponse)
async def auth_status(session: Optional[str] = Query(None)):
    """Check if user is authenticated"""
    if not session:
        return AuthStatusResponse(authenticated=False)

    user_data = get_session(session)
    if not user_data:
        return AuthStatusResponse(authenticated=False)

    return AuthStatusResponse(
        authenticated=True,
        user=UserResponse(**user_data)
    )


@router.post("/logout")
async def logout(session: Optional[str] = Query(None)):
    """Logout user and clear session"""
    if session:
        delete_session(session)

    response = JSONResponse(content={"success": True})
    response.delete_cookie("session")
    return response


@router.get("/me")
async def get_current_user(
    session: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    """Get current authenticated user (supports both JWT and legacy session)"""

    # Try JWT authentication first
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        payload = verify_access_token(token)

        if payload:
            user_id = payload.get("sub")
            # Get user from database
            user = db_service.get_user(user_id)
            if user:
                return {
                    "id": user.get("id"),
                    "email": user.get("email"),
                    "name": user.get("name"),
                    "picture": user.get("picture"),
                }

    # Fallback to legacy session authentication
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_data = get_session(session)
    if not user_data:
        raise HTTPException(status_code=401, detail="Session expired")

    # Don't expose tokens to frontend
    return {
        "id": user_data.get("id"),
        "email": user_data.get("email"),
        "name": user_data.get("name"),
        "picture": user_data.get("picture"),
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(request: RefreshTokenRequest):
    """
    Refresh access token using refresh token.
    Returns new access token and refresh token.
    """
    payload = verify_refresh_token(request.refresh_token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_id = payload.get("sub")

    # Get user from database
    user = db_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Create new access token
    new_access_token = create_access_token(user_id, user.get("email"))

    # Create new refresh token (rotate refresh tokens for security)
    new_refresh_token, new_token_id = create_refresh_token(user_id)

    # Revoke old refresh token
    old_token_id = payload.get("jti")
    if old_token_id:
        revoke_refresh_token(old_token_id)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/logout-all")
async def logout_all_devices(authorization: Optional[str] = Header(None)):
    """
    Logout from all devices by revoking all refresh tokens.
    Requires valid access token.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.replace("Bearer ", "")
    payload = verify_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    count = revoke_all_user_tokens(user_id)

    return {"success": True, "revoked_tokens": count}


def get_user_tokens(user_id: str) -> Optional[dict]:
    """Get user's OAuth tokens for Sheets/Drive access"""
    # Check all sessions for this user
    for session_data in sessions.values():
        if session_data.get("id") == user_id:
            return session_data.get("tokens")
    return None


# DEV ONLY: Test session endpoint for Playwright testing
@router.post("/dev/test-session")
async def create_test_session():
    """
    DEV ONLY: Create a test session for automated testing.
    Remove this endpoint in production.
    """
    test_user = {
        "id": "test-user-123",
        "email": "test@example.com",
        "name": "Test User",
        "picture": None,
    }

    # Create or get existing user in DB
    from app.services.db_service import db_service
    try:
        db_service.get_or_create_user(
            google_id=test_user["id"],
            email=test_user["email"],
            name=test_user["name"],
            picture=test_user["picture"]
        )
    except Exception:
        pass  # User might already exist

    session_id = create_session(test_user)
    return {"session": session_id, "user": test_user}
