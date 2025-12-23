"""
OAuth API Routes
Handles OAuth flows for Google Ads and other providers.
"""

import base64
import json
import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
from app.config import settings
from app.services.firebase_service import firebase_service

router = APIRouter()


class OAuthInitResponse(BaseModel):
    auth_url: str
    provider: str
    message: str


class OAuthCallbackResponse(BaseModel):
    success: bool
    provider: str
    message: str


def encode_state(user_id: str, provider: str) -> str:
    """Encode user_id and provider into URL-safe state parameter"""
    state_data = {"user_id": user_id, "provider": provider}
    json_bytes = json.dumps(state_data).encode('utf-8')
    return base64.urlsafe_b64encode(json_bytes).decode('utf-8')


def decode_state(state: str) -> dict:
    """Decode state parameter back to user_id and provider"""
    try:
        json_bytes = base64.urlsafe_b64decode(state.encode('utf-8'))
        return json.loads(json_bytes.decode('utf-8'))
    except Exception:
        return {}


async def exchange_code_for_tokens(code: str) -> dict:
    """Exchange authorization code for access and refresh tokens"""
    token_url = "https://oauth2.googleapis.com/token"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            token_url,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.google_redirect_uri,
            },
        )

        if response.status_code != 200:
            error_data = response.json()
            raise HTTPException(
                status_code=400,
                detail=f"Token exchange failed: {error_data.get('error_description', error_data.get('error', 'Unknown error'))}"
            )

        return response.json()


async def refresh_access_token(refresh_token: str) -> dict:
    """Refresh expired access token"""
    token_url = "https://oauth2.googleapis.com/token"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            token_url,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )

        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Token refresh failed")

        return response.json()


@router.post("/{provider}/init", response_model=OAuthInitResponse)
async def init_oauth(provider: str, user_id: str = Query(default="demo")):
    """
    Initialize OAuth flow for a provider
    """
    if provider not in ['google-ads', 'facebook-ads']:
        raise HTTPException(status_code=400, detail=f"Provider {provider} not supported")

    if provider == 'google-ads':
        if settings.is_development:
            # Mock OAuth URL for development
            state = encode_state(user_id, provider)
            auth_url = f"http://localhost:8000/api/oauth/{provider}/callback?code=mock_code&state={state}"
        else:
            # Real OAuth URL with state containing user_id
            state = encode_state(user_id, provider)
            # Include Sheets/Drive scopes for dashboard creation
            scopes = [
                "https://www.googleapis.com/auth/adwords",
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive.file",
            ]
            scope = " ".join(scopes)
            auth_url = (
                f"https://accounts.google.com/o/oauth2/v2/auth?"
                f"client_id={settings.google_client_id}&"
                f"redirect_uri={settings.google_redirect_uri}&"
                f"response_type=code&"
                f"scope={scope}&"
                f"access_type=offline&"
                f"prompt=consent&"
                f"state={state}"
            )

        return OAuthInitResponse(
            auth_url=auth_url,
            provider=provider,
            message="Click the link to authorize Google Ads access"
        )

    raise HTTPException(status_code=400, detail="Provider not yet implemented")


@router.get("/{provider}/callback", response_class=HTMLResponse)
async def oauth_callback(
    provider: str,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None
):
    """
    Handle OAuth callback - exchanges code for tokens and stores them
    Returns HTML that closes the popup and notifies parent window
    """

    def callback_html(success: bool, message: str, provider: str) -> str:
        """Generate HTML response that communicates with parent window"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>OAuth Callback</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }}
                .container {{
                    text-align: center;
                    padding: 2rem;
                    background: rgba(255,255,255,0.1);
                    border-radius: 16px;
                    backdrop-filter: blur(10px);
                }}
                .icon {{ font-size: 4rem; margin-bottom: 1rem; }}
                .message {{ font-size: 1.2rem; margin-bottom: 1rem; }}
                .status {{ opacity: 0.8; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">{"✅" if success else "❌"}</div>
                <div class="message">{message}</div>
                <div class="status">{"Closing window..." if success else "Please close this window"}</div>
            </div>
            <script>
                // Send message to parent window
                if (window.opener) {{
                    window.opener.postMessage({{
                        type: 'oauth_callback',
                        success: {str(success).lower()},
                        provider: '{provider}',
                        message: '{message}'
                    }}, '*');

                    // Close popup after short delay
                    if ({str(success).lower()}) {{
                        setTimeout(() => window.close(), 1500);
                    }}
                }} else {{
                    // Not a popup, redirect to main app
                    setTimeout(() => {{
                        window.location.href = '/';
                    }}, 2000);
                }}
            </script>
        </body>
        </html>
        """

    # Handle errors
    if error:
        return callback_html(False, f"Authorization failed: {error}", provider)

    if not code:
        return callback_html(False, "No authorization code received", provider)

    # Decode state to get user_id
    state_data = decode_state(state) if state else {}
    user_id = state_data.get("user_id", "demo")

    if provider == 'google-ads':
        if settings.is_development:
            # Mock successful OAuth - store mock tokens
            mock_tokens = {
                "access_token": "mock_access_token_12345",
                "refresh_token": "mock_refresh_token_67890",
                "expires_in": 3600,
                "token_type": "Bearer",
                "scope": "https://www.googleapis.com/auth/adwords"
            }
            firebase_service.save_connector(user_id, "google_ads", mock_tokens)
            return callback_html(True, "Successfully connected to Google Ads", provider)

        try:
            # Exchange code for tokens
            tokens = await exchange_code_for_tokens(code)

            # Store tokens in Firebase
            firebase_service.save_connector(user_id, "google_ads", {
                "access_token": tokens.get("access_token"),
                "refresh_token": tokens.get("refresh_token"),
                "expires_in": tokens.get("expires_in"),
                "token_type": tokens.get("token_type"),
                "scope": tokens.get("scope")
            })

            return callback_html(True, "Successfully connected to Google Ads", provider)

        except HTTPException as e:
            return callback_html(False, str(e.detail), provider)
        except Exception as e:
            return callback_html(False, f"Connection failed: {str(e)}", provider)

    return callback_html(False, f"Provider {provider} not supported", provider)


@router.get("/{provider}/status")
async def get_oauth_status(provider: str, user_id: str = Query(default="demo")):
    """Check if a provider is connected for a user"""
    provider_key = provider.replace("-", "_")  # google-ads -> google_ads
    connector = firebase_service.get_connector(user_id, provider_key)

    if connector:
        return {
            "connected": True,
            "provider": provider,
            "connected_at": connector.get("connected_at")
        }

    return {
        "connected": False,
        "provider": provider
    }


@router.delete("/{provider}/disconnect")
async def disconnect_oauth(provider: str, user_id: str = Query(default="demo")):
    """Disconnect a provider for a user"""
    provider_key = provider.replace("-", "_")
    success = firebase_service.delete_connector(user_id, provider_key)

    return {
        "success": success,
        "provider": provider,
        "message": f"Disconnected from {provider}" if success else f"Not connected to {provider}"
    }
