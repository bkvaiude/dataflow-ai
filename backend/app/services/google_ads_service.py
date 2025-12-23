"""
Google Ads Service
Fetches campaign data from Google Ads API using OAuth credentials.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from app.config import settings
from app.tools.agent_tools import MOCK_CAMPAIGNS


class MockGoogleAdsService:
    """Mock Google Ads service for development"""

    def __init__(self):
        print("MockGoogleAdsService initialized (development mode)")

    def get_campaigns(self, customer_id: str = None) -> List[Dict[str, Any]]:
        """Return mock campaign data"""
        return MOCK_CAMPAIGNS

    def get_campaign_performance(
        self, customer_id: str = None, days: int = 30
    ) -> List[Dict[str, Any]]:
        """Return mock performance data"""
        campaigns = []
        for camp in MOCK_CAMPAIGNS:
            campaigns.append({
                **camp,
                "clicks": int(camp["spend"] / 0.5),
                "impressions": int(camp["spend"] / 0.5 * 25),
                "event_time": datetime.now().isoformat()
            })
        return campaigns


class GoogleAdsService:
    """
    Google Ads Service.
    Uses google-ads library with user OAuth tokens in production, mock in development.
    """

    def __init__(self):
        self.is_mock = True
        self.client = None

        if settings.is_development:
            self.client = MockGoogleAdsService()
        else:
            self._init_google_ads_client()

    def _init_google_ads_client(self):
        """Initialize real Google Ads client (requires user tokens per request)"""
        try:
            from google.ads.googleads.client import GoogleAdsClient

            # Base client for testing - actual calls will use user tokens
            self.is_mock = False
            print("Google Ads Service initialized")
        except ImportError as e:
            print(f"Failed to initialize Google Ads service: {e}")
            self.client = MockGoogleAdsService()
            self.is_mock = True

    def _create_client_for_user(self, tokens: Dict[str, Any]) -> Optional[Any]:
        """Create a Google Ads client using user's OAuth tokens"""
        try:
            from google.ads.googleads.client import GoogleAdsClient

            # Create client config from user tokens
            config = {
                "developer_token": settings.google_ads_developer_token,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": tokens.get("refresh_token"),
                "use_proto_plus": True,
            }

            return GoogleAdsClient.load_from_dict(config)

        except Exception as e:
            print(f"Failed to create Google Ads client: {e}")
            return None

    def get_campaigns(
        self, customer_id: str, tokens: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Get all campaigns for a customer"""
        if self.is_mock or not tokens:
            if self.is_mock:
                return self.client.get_campaigns(customer_id)
            return MOCK_CAMPAIGNS

        client = self._create_client_for_user(tokens)
        if not client:
            return MOCK_CAMPAIGNS

        try:
            ga_service = client.get_service("GoogleAdsService")

            query = """
                SELECT
                    campaign.id,
                    campaign.name,
                    campaign.status,
                    metrics.cost_micros,
                    metrics.clicks,
                    metrics.impressions,
                    metrics.conversions,
                    metrics.conversions_value
                FROM campaign
                WHERE campaign.status = 'ENABLED'
                AND segments.date DURING LAST_30_DAYS
            """

            campaigns = []
            response = ga_service.search_stream(
                customer_id=customer_id.replace("-", ""),
                query=query
            )

            for batch in response:
                for row in batch.results:
                    campaigns.append({
                        "campaign_id": str(row.campaign.id),
                        "name": row.campaign.name,
                        "status": row.campaign.status.name,
                        "spend": row.metrics.cost_micros / 1_000_000,  # Convert micros to dollars
                        "clicks": row.metrics.clicks,
                        "impressions": row.metrics.impressions,
                        "conversions": row.metrics.conversions,
                        "conversion_value": row.metrics.conversions_value,
                    })

            return campaigns if campaigns else MOCK_CAMPAIGNS

        except Exception as e:
            print(f"Google Ads API error: {e}")
            return MOCK_CAMPAIGNS

    def get_campaign_performance(
        self,
        customer_id: str,
        days: int = 30,
        tokens: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Get campaign performance metrics with streaming-ready format"""
        campaigns = self.get_campaigns(customer_id, tokens)

        # Add event_time for Kafka streaming
        for camp in campaigns:
            camp["event_time"] = datetime.now().isoformat()

        return campaigns

    def fetch_and_stream(
        self,
        customer_id: str,
        tokens: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """Fetch campaigns and stream to Kafka"""
        from app.services.kafka_producer import kafka_producer

        campaigns = self.get_campaigns(customer_id, tokens)

        if not campaigns:
            return {"success": False, "message": "No campaigns found", "count": 0}

        # Stream each campaign to Kafka
        streamed = 0
        for campaign in campaigns:
            try:
                kafka_producer.produce_google_ads_data(campaign, user_id=user_id)
                streamed += 1
            except Exception as e:
                print(f"Failed to stream campaign {campaign.get('campaign_id')}: {e}")

        # Flush to ensure delivery
        kafka_producer.flush()

        return {
            "success": True,
            "message": f"Streamed {streamed} campaigns to Kafka",
            "count": streamed,
            "topic": "raw_google_ads"
        }


# Singleton instance
google_ads_service = GoogleAdsService()
