"""
Gemini AI service using LangChain + LangGraph.
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
    Gemini AI service for chat processing using LangChain + LangGraph.
    Uses mock responses when no API key is configured.
    Otherwise integrates with Gemini via LangChain.
    """

    def __init__(self):
        self.conversation_history: Dict[str, List[Dict]] = {}
        self.llm = None
        self.agent = None

        # Use mock only when no API key is available
        if settings.use_mock_gemini:
            print("Running in mock mode (no Gemini API key configured)")
        else:
            self._init_langchain_agent()

    def _init_langchain_agent(self):
        """Initialize LangChain Agent with Gemini using LangGraph"""
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langgraph.prebuilt import create_react_agent

            # Initialize the Gemini LLM
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                google_api_key=settings.gemini_api_key,
                temperature=0.7,
            )

            # Get LangChain tools
            tools = get_all_tools()

            # Create the agent using LangGraph
            self.agent = create_react_agent(
                model=self.llm,
                tools=tools,
                prompt=self._get_system_prompt(),
            )

            print("LangChain Agent initialized with Gemini 2.0 Flash")

        except Exception as e:
            print(f"Failed to initialize LangChain Agent: {e}")
            import traceback
            traceback.print_exc()
            self.llm = None
            self.agent = None

    def _get_system_prompt(self) -> str:
        return """You are DataFlow AI, a real-time data platform assistant that sets up both MARKETING ANALYTICS and DATABASE CDC (Change Data Capture) pipelines.

## What Makes You Special
You create enterprise-grade streaming infrastructure for two types of data sources:

### 1. Marketing Data Sources (OAuth-based)
- Google Ads, Facebook Ads, Shopify (coming soon)
- Kafka for real-time streaming
- Flink for continuous metric calculations (ROAS, CPC, CTR)
- Live dashboards that update automatically

### 2. Database CDC Sources (PostgreSQL)
- Change Data Capture from PostgreSQL databases
- Real-time database replication
- Schema discovery and validation
- CDC readiness checks with provider-specific instructions

## Your Tools

### Marketing Analytics Tools:
1. list_available_connectors - Show supported marketing data sources
2. check_connector_status - Check if a marketing source is connected
3. initiate_oauth - Start OAuth authorization
4. create_kafka_pipeline - Start real-time streaming from marketing sources
5. generate_dashboard - Create dashboard from processed marketing data

### CDC (Database) Tools:
6. store_credentials - Securely store database credentials with AES-256-GCM encryption
7. discover_schema - Explore database tables, columns, relationships, and CDC eligibility
8. check_cdc_readiness - Validate PostgreSQL configuration for CDC (wal_level, replication privileges, etc.)

## Conversation Flows

### Marketing Analytics Flow:
1. User wants to track ads → Check connection status
2. Not connected → Initiate OAuth
3. After OAuth success → Create Kafka pipeline
4. Pipeline streaming → Generate dashboard

### Database CDC Flow:
1. User wants CDC from database → Store encrypted credentials
2. Credentials stored → Discover schema to see available tables
3. Schema discovered → Check CDC readiness
4. If not ready → Provide provider-specific fix instructions (AWS RDS, Supabase, Cloud SQL, Azure, Self-hosted)
5. Database ready → Set up CDC pipeline (Phase 2)

## Response Style
- Be friendly and enthusiastic about real-time data streaming
- Highlight the Kafka + Flink streaming architecture
- For CDC: Explain the importance of logical replication and primary keys
- Celebrate successful connections and validations
- Always provide clear next steps
- Keep responses concise but informative
- When user asks about CDC or databases, focus on the CDC tools
- When user asks about marketing/ads, focus on the marketing tools

## Provider-Specific CDC Guidance
When checking CDC readiness, provide specific instructions for:
- **AWS RDS**: Parameter groups and rds.logical_replication
- **Supabase**: Dashboard-based configuration
- **Google Cloud SQL**: cloudsql.logical_decoding flag
- **Azure Database**: azure.replication_support parameter
- **Self-Hosted**: postgresql.conf and wal_level setting

## Important
- Marketing: Only Google Ads is currently available, others coming soon
- CDC: Only PostgreSQL is currently supported
- Always explain data flow: Source → Kafka → Flink → Destination
- For CDC: Emphasize security (AES-256-GCM encryption for credentials)
- When showing metrics, highlight both best and worst performers"""

    async def process_message(self, message: str, user_id: str) -> Dict[str, Any]:
        """Process a chat message and return a response"""

        # Set user context for tools
        set_user_context(user_id)

        # Get or create conversation history
        if user_id not in self.conversation_history:
            self.conversation_history[user_id] = []

        history = self.conversation_history[user_id]

        # Choose processing method based on agent availability
        if self.agent is None:
            response = await self._mock_process(message, history)
        else:
            response = await self._langchain_process(message, user_id, history)

        # Update history
        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": response["content"]})

        # Keep only last 20 messages
        self.conversation_history[user_id] = history[-20:]

        return response

    async def _langchain_process(
        self, message: str, user_id: str, history: List[Dict]
    ) -> Dict[str, Any]:
        """Process message with LangGraph Agent"""
        try:
            from langchain_core.messages import HumanMessage, AIMessage

            # Convert history to LangChain message format
            messages = []
            for msg in history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                else:
                    messages.append(AIMessage(content=msg["content"]))

            # Add current message
            messages.append(HumanMessage(content=message))

            # Run the agent with messages
            result = await self.agent.ainvoke({
                "messages": messages,
            })

            # Extract the output from the last AI message
            output_messages = result.get("messages", [])
            content = "I'm sorry, I couldn't process that request."

            for msg in reversed(output_messages):
                if hasattr(msg, 'content') and msg.content:
                    # Skip tool messages
                    if hasattr(msg, 'type') and msg.type == 'tool':
                        continue
                    content = msg.content
                    break

            # Extract actions from the response
            actions = self._extract_actions(content)

            return {
                "content": content,
                "actions": actions
            }

        except Exception as e:
            print(f"LangChain processing error: {e}")
            import traceback
            traceback.print_exc()
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

        # Check for confirm_reprocess action (highest priority)
        if '"action_type": "confirm_reprocess"' in content or 'already processed' in content_lower:
            # Try to extract confirmation data from content
            try:
                # Look for JSON with confirmation_data
                json_match = re.search(r'\{[^{}]*"confirmation_data"\s*:\s*\{[^{}]*\}[^{}]*\}', content, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                    confirmation_data = data.get('confirmation_data', {})
                    actions.append({
                        "type": "confirm_reprocess",
                        "label": "Reprocess Data",
                        "confirmationData": {
                            "connectorId": confirmation_data.get("connector_id", "google_ads"),
                            "customerId": confirmation_data.get("customer_id", ""),
                            "userId": confirmation_data.get("user_id", "")
                        }
                    })
                    return actions  # Return early, no other actions needed
            except (json.JSONDecodeError, AttributeError):
                pass

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
