"""
Google Sheets Service
Creates dashboards in USER's Google Drive using their OAuth tokens.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from app.config import settings


class MockSheetsService:
    """Mock Sheets service for development"""

    def __init__(self):
        print("MockSheetsService initialized (development mode)")

    def create_dashboard(self, data: List[Dict], user_id: str, tokens: Dict = None) -> str:
        return "https://docs.google.com/spreadsheets/d/demo-dashboard"


class SheetsService:
    """
    Google Sheets Service.
    Creates dashboards in user's Drive using their OAuth tokens.
    """

    def __init__(self):
        # Sheets always uses user OAuth tokens, no service-level mock needed
        self.is_mock = False
        print("SheetsService initialized (uses user OAuth tokens)")

    def _get_client_for_user(self, tokens: Dict[str, Any]):
        """Create gspread client using user's OAuth tokens"""
        try:
            import gspread
            from google.oauth2.credentials import Credentials

            creds = Credentials(
                token=tokens.get("access_token"),
                refresh_token=tokens.get("refresh_token"),
                token_uri="https://oauth2.googleapis.com/token",
                client_id=settings.google_client_id,
                client_secret=settings.google_client_secret,
            )

            return gspread.authorize(creds)

        except Exception as e:
            print(f"Failed to create Sheets client: {e}")
            return None

    def create_dashboard(
        self,
        data: List[Dict[str, Any]],
        user_id: str,
        tokens: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a marketing dashboard in user's Google Drive"""

        # No tokens - return demo URL
        if not tokens:
            print(f"[SHEETS] No tokens available, returning demo dashboard for {user_id}")
            return "https://docs.google.com/spreadsheets/d/demo-dashboard"

        access_token = tokens.get("access_token", "")
        if not access_token:
            print(f"[SHEETS] No access token, returning demo dashboard for {user_id}")
            return "https://docs.google.com/spreadsheets/d/demo-dashboard"

        client = self._get_client_for_user(tokens)
        if not client:
            return "https://docs.google.com/spreadsheets/d/demo-dashboard"

        try:
            title = f"DataFlow Dashboard - {datetime.now().strftime('%Y-%m-%d %H:%M')}"

            # Create spreadsheet in user's Drive
            spreadsheet = client.create(title)
            worksheet = spreadsheet.sheet1
            worksheet.update_title("Campaign Performance")

            # Headers
            headers = [
                "Campaign ID", "Campaign Name", "ROAS", "CPC", "CTR",
                "Spend", "Clicks", "Impressions", "Conversions", "Revenue"
            ]
            worksheet.update('A1', [headers])

            # Format headers
            worksheet.format('A1:J1', {
                'textFormat': {'bold': True},
                'backgroundColor': {'red': 0.2, 'green': 0.4, 'blue': 0.8}
            })

            # Write data
            rows = []
            for d in data:
                rows.append([
                    d.get('campaign_id', ''),
                    d.get('campaign_name', d.get('name', '')),
                    d.get('roas', 0),
                    d.get('cpc', 0),
                    d.get('ctr', 0),
                    d.get('total_spend', d.get('spend', 0)),
                    d.get('total_clicks', d.get('clicks', 0)),
                    d.get('total_impressions', d.get('impressions', 0)),
                    d.get('total_conversions', d.get('conversions', 0)),
                    d.get('total_revenue', d.get('conversion_value', 0))
                ])

            if rows:
                worksheet.update(f'A2:J{len(rows) + 1}', rows)

            print(f"[SHEETS] Created dashboard: {spreadsheet.url}")
            return spreadsheet.url

        except Exception as e:
            print(f"Error creating dashboard: {e}")
            return "https://docs.google.com/spreadsheets/d/error-creating-dashboard"


# Singleton instance
sheets_service = SheetsService()
