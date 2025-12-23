"""
Gemini AI service using Google ADK (Agent Development Kit).
Provides a conversational AI agent with tools for data pipeline management.
"""

from typing import Dict, Any, List
import json
import re
from app.config import settings
from app.tools.agent_tools import (
    get_all_tools,
    set_user_context,
    list_available_connectors,
    check_connector_status,
    initiate_oauth,
    create_kafka_pipeline,
    generate_dashboard,
    MOCK_PROCESSED_METRICS
)


class GeminiService:
    """
    Gemini AI service for chat processing using Google ADK.
    In development mode, uses mock responses.
    In production, integrates with Google ADK Agent.
    """

    def __init__(self):
        self.conversation_history: Dict[str, List[Dict]] = {}
        self.agent = None
        self.runner = None

        if not settings.is_development and settings.google_api_key:
            self._init_adk_agent()
        else:
            print("Running in mock mode (no Gemini API key or development mode)")

    def _init_adk_agent(self):
        """Initialize Google ADK Agent with Gemini"""
        try:
            from google.adk.agents import Agent
            from google.adk.runners import Runner
            from google.genai import types

            # Create the ADK Agent
            self.agent = Agent(
                model='gemini-2.0-flash',
                name='dataflow_agent',
                description='Marketing analytics assistant that sets up real-time streaming data pipelines using Kafka and Flink.',
                instruction=self._get_system_prompt(),
                tools=get_all_tools(),
            )

            # Create the Runner
            self.runner = Runner(
                agent=self.agent,
                app_name='DataFlow AI'
            )

            print("Google ADK Agent initialized with Gemini 2.0 Flash")

        except Exception as e:
            print(f"Failed to initialize Google ADK: {e}")
            self.agent = None
            self.runner = None

    def _get_system_prompt(self) -> str:
        return """You are DataFlow AI, a marketing analytics assistant that sets up REAL-TIME streaming data pipelines.

## What Makes You Special
You don't just pull data - you create enterprise-grade streaming infrastructure:
- Kafka for real-time data streaming
- Flink for continuous metric calculations (ROAS, CPC, CTR)
- Live dashboards that update automatically

## Your Tools
1. list_available_connectors - Show supported data sources
2. check_connector_status - Check if a source is connected
3. initiate_oauth - Start OAuth authorization
4. create_kafka_pipeline - Start real-time streaming
5. generate_dashboard - Create dashboard from processed data

## Conversation Flow
1. When user wants to track ads → First check connection status
2. Not connected → Initiate OAuth
3. After OAuth success → Create Kafka pipeline
4. Pipeline streaming → Generate dashboard
5. Always provide actionable insights with the dashboard

## Response Style
- Be friendly and enthusiastic about real-time data
- Highlight the Kafka + Flink streaming architecture
- Celebrate successful connections
- Always provide clear next steps
- Keep responses concise but informative

## Important
- Only Google Ads is currently available, other connectors are coming soon
- Always explain the data flow: Source → Kafka → Flink → Dashboard
- When showing metrics, highlight both best and worst performers"""

    async def process_message(self, message: str, user_id: str) -> Dict[str, Any]:
        """Process a chat message and return a response"""

        # Set user context for tools
        set_user_context(user_id)

        # Get or create conversation history
        if user_id not in self.conversation_history:
            self.conversation_history[user_id] = []

        history = self.conversation_history[user_id]

        # In development mode or if agent not initialized, use smart mock responses
        if settings.is_development or self.runner is None:
            response = await self._mock_process(message, history)
        else:
            response = await self._adk_process(message, user_id, history)

        # Update history
        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": response["content"]})

        # Keep only last 20 messages
        self.conversation_history[user_id] = history[-20:]

        return response

    async def _adk_process(self, message: str, user_id: str, history: List[Dict]) -> Dict[str, Any]:
        """Process message with Google ADK Agent"""
        try:
            # Create a session for this user
            session_id = f"session_{user_id}"

            # Run the agent
            result = await self.runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=message
            )

            # Extract the response content
            content = str(result) if result else "I'm sorry, I couldn't process that request."

            # Extract actions from the response
            actions = self._extract_actions(content)

            return {
                "content": content,
                "actions": actions
            }

        except Exception as e:
            print(f"ADK processing error: {e}")
            # Fall back to mock on error
            return await self._mock_process(message, history)

    async def _mock_process(self, message: str, history: List[Dict]) -> Dict[str, Any]:
        """Smart mock responses for development"""
        message_lower = message.lower()

        # Check for connector-related queries
        if any(word in message_lower for word in ['connect', 'google ads', 'link', 'authorize']):
            return {
                "content": """Great choice! Let me help you connect Google Ads.

When you authorize, your data will flow through our **real-time streaming pipeline**:

📊 **Google Ads API** → **Kafka** → **Flink** → **Dashboard**

This means your metrics (ROAS, CPC, CTR) will be calculated continuously, not just when you refresh!

Click below to authorize access:""",
                "actions": [
                    {
                        "type": "oauth",
                        "provider": "google_ads",
                        "label": "Connect Google Ads"
                    }
                ]
            }

        # Check for data source queries
        if any(word in message_lower for word in ['data source', 'available', 'what can', 'supported', 'connectors']):
            return {
                "content": """Here are the data sources I can connect to:

**Available Now:**
🎯 **Google Ads** - Full campaign metrics, real-time ROAS tracking

**Coming Soon:**
📘 Facebook Ads
🛒 Shopify
📧 HubSpot

Would you like to connect Google Ads? I'll set up a real-time streaming pipeline with Kafka and Flink!""",
                "actions": []
            }

        # Check for pipeline/streaming queries
        if any(word in message_lower for word in ['stream', 'pipeline', 'kafka', 'start']):
            return {
                "content": """🚀 **Starting your real-time streaming pipeline!**

Your data will flow through:
1. **Google Ads API** - Pulling campaign metrics
2. **Kafka** - Streaming to `raw_google_ads` topic
3. **Flink** - Calculating ROAS, CPC, CTR in real-time
4. **Dashboard** - Updating automatically

Pipeline Status: ✅ **Active**
Topic: `raw_google_ads`
Processing: `processed_metrics`

Your dashboard will update as new data flows in!""",
                "actions": [
                    {
                        "type": "button",
                        "label": "View Pipeline Status"
                    }
                ]
            }

        # Check for performance/metrics queries
        if any(word in message_lower for word in ['performance', 'metrics', 'show me', 'dashboard', 'roas', 'campaigns', 'insights']):
            # Generate mock dashboard
            top_campaign = max(MOCK_PROCESSED_METRICS, key=lambda x: x['roas'])
            worst_campaign = min(MOCK_PROCESSED_METRICS, key=lambda x: x['roas'])

            return {
                "content": f"""Here's your real-time campaign performance!

**📊 Campaign Metrics (Live via Kafka + Flink)**

| Campaign | ROAS | CPC | CTR |
|----------|------|-----|-----|
| Summer Sale | 5.20x | $0.83 | 4.2% |
| Brand Awareness | 0.80x | $1.20 | 1.8% |
| Retargeting | 4.10x | $0.65 | 5.1% |

**🎯 Key Insights:**
✅ Top performer: **{top_campaign['campaign_name']}** with {top_campaign['roas']}x ROAS
⚠️ Needs attention: **{worst_campaign['campaign_name']}** is underperforming at {worst_campaign['roas']}x ROAS

Your dashboard updates automatically as new data streams in through Kafka!""",
                "actions": [
                    {
                        "type": "link",
                        "url": "https://docs.google.com/spreadsheets/d/demo-dashboard",
                        "label": "View Full Dashboard"
                    }
                ]
            }

        # Default response
        return {
            "content": """I'm DataFlow AI, your real-time marketing analytics assistant!

I help you:
- **Connect data sources** (Google Ads, Facebook Ads, etc.)
- **Stream data through Kafka** for real-time processing
- **Calculate metrics with Flink** (ROAS, CPC, CTR)
- **Generate live dashboards** that update automatically

Try saying:
- "Connect my Google Ads"
- "Show me my campaign performance"
- "What data sources are available?"
- "Start streaming my data"

How can I help you today?""",
            "actions": []
        }

    def _extract_actions(self, content: str) -> List[Dict[str, Any]]:
        """Extract UI actions from agent response content"""
        actions = []

        content_lower = content.lower()

        # Check for OAuth action
        if 'auth_url' in content_lower or 'authorize' in content_lower or 'connect google ads' in content_lower:
            actions.append({
                "type": "oauth",
                "provider": "google_ads",
                "label": "Connect Google Ads"
            })

        # Check for dashboard link
        if 'dashboard_url' in content_lower or 'spreadsheet' in content_lower:
            # Try to extract URL
            url_match = re.search(r'https://docs\.google\.com/spreadsheets/[^\s"\']+', content)
            if url_match:
                actions.append({
                    "type": "link",
                    "url": url_match.group(0),
                    "label": "View Dashboard"
                })

        return actions
