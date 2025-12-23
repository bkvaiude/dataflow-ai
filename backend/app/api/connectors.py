from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


class Connector(BaseModel):
    id: str
    name: str
    provider: str
    status: str  # available, connected, coming_soon
    account_name: Optional[str] = None
    last_sync: Optional[str] = None


class ConnectorStatus(BaseModel):
    connected: bool
    available: bool
    account_name: Optional[str] = None
    last_sync: Optional[str] = None


# Mock connectors data
CONNECTORS = [
    Connector(
        id="google_ads",
        name="Google Ads",
        provider="google_ads",
        status="available"
    ),
    Connector(
        id="facebook_ads",
        name="Facebook Ads",
        provider="facebook_ads",
        status="coming_soon"
    ),
    Connector(
        id="shopify",
        name="Shopify",
        provider="shopify",
        status="coming_soon"
    ),
]

# Store connected connectors (in-memory for demo)
connected_connectors: dict = {}


@router.get("/", response_model=List[Connector])
async def list_connectors():
    """
    List all available connectors
    """
    return CONNECTORS


@router.get("/{provider}/status", response_model=ConnectorStatus)
async def get_connector_status(provider: str):
    """
    Check if a specific connector is connected
    """
    connector = next((c for c in CONNECTORS if c.provider == provider), None)

    if not connector:
        return ConnectorStatus(connected=False, available=False)

    if connector.status == "coming_soon":
        return ConnectorStatus(connected=False, available=False)

    is_connected = provider in connected_connectors

    return ConnectorStatus(
        connected=is_connected,
        available=True,
        account_name=connected_connectors.get(provider, {}).get('account_name'),
        last_sync=connected_connectors.get(provider, {}).get('last_sync')
    )


@router.post("/{provider}/connect")
async def connect_connector(provider: str):
    """
    Mark a connector as connected (called after OAuth success)
    """
    from datetime import datetime

    connected_connectors[provider] = {
        'account_name': f'Demo {provider.replace("_", " ").title()} Account',
        'last_sync': datetime.now().isoformat()
    }

    return {"success": True, "message": f"Connected to {provider}"}


@router.delete("/{provider}/disconnect")
async def disconnect_connector(provider: str):
    """
    Disconnect a connector
    """
    if provider in connected_connectors:
        del connected_connectors[provider]

    return {"success": True, "message": f"Disconnected from {provider}"}
