"""
Authentication API Routes
Handles user authentication via Google OAuth.
"""

import base64
import json
import secrets
import httpx
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional
from app.config import settings
from app.services.db_service import db_service

router = APIRouter()

# In-memory session store (use Redis in production)
sessions: dict = {}


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    picture: Optional[str]


class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: Optional[UserResponse] = None


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

    # For development mode, return mock login
    if settings.is_development and not settings.google_client_id:
        return {"auth_url": "/api/auth/google/callback?code=mock"}

    # Scopes for user profile
    scopes = [
        "openid",
        "email",
        "profile",
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

    # Development mode mock
    if settings.is_development and code == "mock":
        user_data = {
            "id": "demo-user-123",
            "email": "demo@dataflow.ai",
            "name": "Demo User",
            "picture": None,
        }
        # Save user to database
        db_service.create_user(user_data["id"], user_data)
        session_id = create_session(user_data)

        # Redirect to frontend with session token in URL
        return RedirectResponse(url=f"{frontend_url}/auth/callback?session={session_id}")

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

        # Create user data
        user_data = {
            "id": userinfo["id"],
            "email": userinfo.get("email", ""),
            "name": userinfo.get("name"),
            "picture": userinfo.get("picture"),
        }

        # Save user to database
        db_service.create_user(user_data["id"], user_data)

        # Create session
        session_id = create_session(user_data)

        # Redirect to frontend with session token in URL
        # Frontend will extract and store it in localStorage
        return RedirectResponse(url=f"{frontend_url}/auth/callback?session={session_id}")

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
async def get_current_user(session: Optional[str] = Query(None)):
    """Get current authenticated user"""
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_data = get_session(session)
    if not user_data:
        raise HTTPException(status_code=401, detail="Session expired")

    return user_data
