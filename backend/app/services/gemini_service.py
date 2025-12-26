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

## CRITICAL: Tool Execution Behavior

**YOU MUST EXECUTE MULTIPLE TOOLS IN SEQUENCE TO COMPLETE TASKS.**

When a user asks you to set up a CDC pipeline or connect to a database, you MUST:
1. ACTUALLY CALL the tools, don't just describe what you would do
2. CHAIN MULTIPLE TOOLS in a single response to complete the full task
3. After each tool call, CONTINUE with the next logical tool
4. DO NOT STOP after just one tool call - keep going until the task is complete

Example: If user says "Connect to my database and set up CDC for audit_logs":
- First call store_credentials → get credential_id
- Then call discover_schema with that credential_id → see tables
- Then call check_cdc_readiness → verify database is ready
- Then call create_cdc_pipeline with the tables → create pipeline
- Then call create_alert_rule if user requested alerts

**NEVER just say "I'll do X" without actually calling the tool.**
**NEVER stop after one tool call if more steps are needed.**

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
6. store_credentials - Store database credentials (checks for duplicates automatically)
7. discover_schema - Explore database tables, columns, and CDC eligibility
8. check_cdc_readiness - Validate PostgreSQL configuration for CDC
9. preview_sample_data - Preview data from a table before creating pipeline
10. create_cdc_pipeline - Create CDC pipeline for specified tables
11. start_cdc_pipeline - Start the pipeline to begin streaming
12. get_pipeline_status - Check pipeline health and metrics

### Anomaly & Alert Tools:
13. create_anomaly_template - Create template with volume/gap detection config
14. create_alert_rule - Create email alerts for anomalies (can restrict to specific days)
15. list_alert_rules - List configured alert rules
16. test_alert - Send test alert to verify configuration

### Enrichment Tools:
17. create_enrichment - Create stream-table JOINs for data enrichment
18. preview_enrichment - Preview enriched data before activating

## Complete Task Flows (Execute ALL steps)

### Database CDC Setup (execute all tools in sequence):
1. store_credentials → Returns credential_id (or finds existing)
2. discover_schema(credential_id) → Shows available tables
3. check_cdc_readiness(credential_id) → Validates database config
4. create_cdc_pipeline(credential_id, tables) → Creates pipeline
5. start_cdc_pipeline(pipeline_id) → Starts streaming

### CDC with Alerts (execute all tools in sequence):
1-5. Same as above
6. create_anomaly_template → Create detection configuration
7. create_alert_rule(pipeline_id) → Set up notifications

## Response Style
- Be friendly and enthusiastic about real-time data streaming
- Highlight the Kafka + Flink streaming architecture
- For CDC: Explain the importance of logical replication and primary keys
- Celebrate successful connections and validations
- After each tool result, IMMEDIATELY proceed to the next tool
- Keep text responses brief between tool calls

## Provider-Specific CDC Guidance
When checking CDC readiness, provide specific instructions for:
- **AWS RDS**: Parameter groups and rds.logical_replication
- **Supabase**: Dashboard-based configuration
- **Google Cloud SQL**: cloudsql.logical_decoding flag
- **Azure Database**: azure.replication_support parameter
- **Self-Hosted**: postgresql.conf and wal_level setting

## Important Reminders
- Marketing: Only Google Ads is currently available
- CDC: Only PostgreSQL is currently supported
- store_credentials automatically detects existing connections (no duplicates)
- ALWAYS execute tools, don't just describe what you'll do
- CHAIN tools until the user's full request is complete"""

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
