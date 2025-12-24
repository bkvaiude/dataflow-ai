"""
LangChain tools for the DataFlow AI agent.
These tools enable the AI to interact with connectors, Kafka, and dashboards.

Tools use LangChain's @tool decorator for automatic schema generation.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import json
from langchain_core.tools import tool

# Mock data for development (realistic Google Ads campaign data)
MOCK_CAMPAIGNS = [
    {
        "campaign_id": "123",
        "name": "Summer Sale",
        "spend": 5000,
        "clicks": 6024,
        "impressions": 143428,
        "conversions": 250,
        "conversion_value": 26000
    },
    {
        "campaign_id": "456",
        "name": "Brand Awareness",
        "spend": 2000,
        "clicks": 1667,
        "impressions": 92611,
        "conversions": 40,
        "conversion_value": 1600
    },
    {
        "campaign_id": "789",
        "name": "Retargeting",
        "spend": 8420,
        "clicks": 12954,
        "impressions": 254000,
        "conversions": 421,
        "conversion_value": 34550
    },
]

MOCK_PROCESSED_METRICS = [
    {
        "campaign_id": "123",
        "campaign_name": "Summer Sale",
        "roas": 5.20,
        "cpc": 0.83,
        "ctr": 4.2
    },
    {
        "campaign_id": "456",
        "campaign_name": "Brand Awareness",
        "roas": 0.80,
        "cpc": 1.20,
        "ctr": 1.8
    },
    {
        "campaign_id": "789",
        "campaign_name": "Retargeting",
        "roas": 4.10,
        "cpc": 0.65,
        "ctr": 5.1
    },
]

# Current user context (set by the agent session)
_current_user_id: str = "demo"


def set_user_context(user_id: str):
    """Set the current user context for tools."""
    global _current_user_id
    _current_user_id = user_id


def get_user_context() -> str:
    """Get the current user context."""
    return _current_user_id


@tool
def list_available_connectors() -> str:
    """List all available data source connectors.

    Use this tool when the user asks what data sources are supported,
    what connectors are available, or wants to know what they can connect to.

    Returns:
        JSON string with list of available connectors and their status.
    """
    connectors = [
        {"id": "google_ads", "name": "Google Ads", "status": "available"},
        {"id": "facebook_ads", "name": "Facebook Ads", "status": "coming_soon"},
        {"id": "shopify", "name": "Shopify", "status": "coming_soon"}
    ]
    return json.dumps(connectors, indent=2)


@tool
def check_connector_status(provider: str) -> str:
    """Check if a specific data source is connected for the current user.

    Use this tool to verify if a user has already connected a data source
    before suggesting they connect it.

    Args:
        provider: The connector ID to check. Valid values are:
            - 'google_ads' for Google Ads
            - 'facebook_ads' for Facebook Ads
            - 'shopify' for Shopify

    Returns:
        JSON string with connection status and availability info.
    """
    from app.services.firebase_service import firebase_service

    user_id = get_user_context()
    provider_key = provider.replace("-", "_")

    # Check Firebase for user's connector
    connector = firebase_service.get_connector(user_id, provider_key)

    result = {
        "connected": connector is not None,
        "available": provider_key == "google_ads",
        "provider": provider_key,
        "user_id": user_id
    }

    if connector:
        result["connected_at"] = connector.get("connected_at")

    return json.dumps(result, indent=2)


@tool
def initiate_oauth(provider: str) -> str:
    """Start OAuth authorization flow for a data source.

    Use this tool when the user wants to connect a data source and it's
    not yet connected. This returns an auth URL for the user to complete.

    Args:
        provider: The connector ID to authorize. Currently only 'google_ads' is supported.

    Returns:
        JSON string with auth_url that user should visit, or error if unsupported.
    """
    user_id = get_user_context()

    if provider in ["google_ads", "google-ads"]:
        result = {
            "auth_url": f"http://localhost:8000/api/oauth/google-ads/init?user_id={user_id}",
            "provider": "google_ads",
            "message": "Click the Connect Google Ads button to authorize access",
            "action_required": True,
            "action_type": "oauth"
        }
    else:
        result = {
            "error": f"Provider '{provider}' is not supported yet",
            "supported_providers": ["google_ads"]
        }
    return json.dumps(result, indent=2)


@tool
def create_kafka_pipeline(connector_id: str, customer_id: str = "") -> str:
    """Create a real-time Kafka streaming pipeline for a connected data source.

    Use this tool after a user has successfully connected a data source.
    This starts continuous data streaming from the source through Kafka to Flink.

    Args:
        connector_id: The ID of the connected source (e.g., 'google_ads').
        customer_id: Optional Google Ads customer ID (e.g., '123-456-7890').

    Returns:
        JSON string with pipeline status, Kafka topic name, and next steps.
    """
    from app.services.firebase_service import firebase_service
    from app.services.kafka_producer import kafka_producer
    from app.services.google_ads_service import google_ads_service

    user_id = get_user_context()
    provider_key = connector_id.replace("-", "_")
    topic = f"raw_{provider_key}"

    # Check if connector is connected
    connector = firebase_service.get_connector(user_id, provider_key)

    if not connector:
        return json.dumps({
            "status": "error",
            "message": f"Please connect {connector_id} first using the initiate_oauth tool.",
            "action_required": True
        }, indent=2)

    if provider_key == "google_ads":
        tokens = connector.get("tokens", {})

        # Fetch campaigns and stream to Kafka
        if google_ads_service.is_mock:
            # Mock mode: stream mock campaigns
            campaigns = MOCK_CAMPAIGNS
            for campaign in campaigns:
                kafka_producer.produce_google_ads_data(campaign, user_id=user_id)
            kafka_producer.flush()

            result = {
                "status": "streaming",
                "mode": "mock",
                "topic": topic,
                "campaigns_streamed": len(campaigns),
                "pipeline": f"Google Ads → Kafka ({topic}) → Flink → processed_metrics",
                "message": f"Mock pipeline created! Streamed {len(campaigns)} demo campaigns to Kafka.",
                "next_step": "Use generate_dashboard to create your analytics dashboard."
            }
        else:
            # Production mode: use real API
            stream_result = google_ads_service.fetch_and_stream(
                customer_id=customer_id or "demo",
                tokens=tokens,
                user_id=user_id
            )

            result = {
                "status": "streaming" if stream_result["success"] else "error",
                "mode": "production",
                "topic": topic,
                "campaigns_streamed": stream_result.get("count", 0),
                "pipeline": f"Google Ads API → Kafka ({topic}) → Flink → processed_metrics",
                "message": stream_result["message"],
                "next_step": "Use generate_dashboard to create your analytics dashboard."
            }
    else:
        result = {
            "status": "error",
            "message": f"Pipeline for '{connector_id}' is not supported yet."
        }

    return json.dumps(result, indent=2)


@tool
def generate_dashboard(use_real_data: bool = True) -> str:
    """Generate a Google Sheets dashboard from processed Kafka data.

    Use this tool when the user wants to see their marketing performance,
    view their dashboard, or get campaign insights. This consumes data from
    the processed_metrics Kafka topic and creates a formatted dashboard.

    Args:
        use_real_data: Whether to consume real data from Kafka (True) or use mock data (False).

    Returns:
        JSON string with dashboard URL, key insights, and campaign summary.
    """
    from app.services.kafka_consumer import kafka_consumer
    from app.services.sheets_service import sheets_service

    user_id = get_user_context()

    # Try to get real processed data from Kafka
    if use_real_data and not kafka_consumer.is_mock:
        data = kafka_consumer.consume_processed_metrics(limit=100)
    else:
        data = MOCK_PROCESSED_METRICS

    if not data:
        data = MOCK_PROCESSED_METRICS

    if data:
        top = max(data, key=lambda x: x.get('roas', 0))
        worst = min(data, key=lambda x: x.get('roas', float('inf')))

        insight = f"Top performer: '{top.get('campaign_name', top.get('name', 'Unknown'))}' with {top.get('roas', 0):.1f}x ROAS."
        warning = None
        if worst.get('roas', 0) < 1:
            warning = f"'{worst.get('campaign_name', worst.get('name', 'Unknown'))}' is losing money at {worst.get('roas', 0):.1f}x ROAS - consider pausing."

        # Get user's OAuth tokens for Sheets access (from login, not Google Ads)
        from app.api.auth import get_user_tokens
        tokens = get_user_tokens(user_id)

        # Create dashboard in user's Google Drive
        try:
            dashboard_url = sheets_service.create_dashboard(data, user_id, tokens)
        except Exception as e:
            dashboard_url = "https://docs.google.com/spreadsheets/d/demo-dashboard"
            print(f"Failed to create dashboard: {e}")

        roas_values = [d.get('roas', 0) for d in data]

        result = {
            "dashboard_url": dashboard_url,
            "insight": insight,
            "warning": warning,
            "campaigns_count": len(data),
            "generated_at": datetime.now().isoformat(),
            "action_type": "dashboard",
            "metrics_summary": {
                "total_campaigns": len(data),
                "avg_roas": round(sum(roas_values) / len(roas_values), 2) if roas_values else 0,
                "best_roas": max(roas_values) if roas_values else 0,
                "worst_roas": min(roas_values) if roas_values else 0
            }
        }
    else:
        result = {
            "status": "no_data",
            "message": "No processed data available yet. Please connect a data source and create a pipeline first."
        }

    return json.dumps(result, indent=2)


def get_all_tools() -> list:
    """Get all LangChain tools for the agent."""
    return [
        list_available_connectors,
        check_connector_status,
        initiate_oauth,
        create_kafka_pipeline,
        generate_dashboard
    ]


# Keep backward compatibility with old get_tools function
def get_tools() -> List[Dict[str, Any]]:
    """Legacy function for backward compatibility."""
    return [
        {
            "name": "list_available_connectors",
            "description": "List all available data source connectors",
            "func": list_available_connectors
        },
        {
            "name": "check_connector_status",
            "description": "Check if a specific data source is connected",
            "func": check_connector_status
        },
        {
            "name": "initiate_oauth",
            "description": "Start OAuth authorization flow for a data source",
            "func": initiate_oauth
        },
        {
            "name": "create_kafka_pipeline",
            "description": "Create real-time Kafka streaming pipeline",
            "func": create_kafka_pipeline
        },
        {
            "name": "generate_dashboard",
            "description": "Generate Google Sheets dashboard from processed data",
            "func": generate_dashboard
        }
    ]
