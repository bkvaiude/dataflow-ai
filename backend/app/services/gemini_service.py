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

## CRITICAL: Interactive Confirmation Workflow

**USE STEP-BY-STEP CONFIRMATION FOR ALL DATA OPERATIONS.**

You MUST use interactive workflows that get user confirmation before:
- Storing credentials (use secure password form, NOT plain text in chat)
- Selecting which tables to sync (let user choose from discovered tables)
- Choosing destination (let user pick ClickHouse, Kafka, etc.)
- Creating pipelines (show summary for user review)
- Setting up alerts (let user configure days, hours, recipients)

**NEVER:**
- Ask for passwords in chat text - use the secure credential form
- Auto-select tables without user confirmation
- Choose destinations without asking
- Create pipelines without final review
- Set up alerts with default values without asking

## Interactive Workflow Tools (ALWAYS USE THESE FIRST)

### 1. start_cdc_pipeline_setup
Use this when a user wants to set up a CDC/database pipeline.
This initiates an interactive workflow:
1. Shows secure credential form (password NOT in chat)
2. Shows table selector after connection succeeds
3. Shows destination picker
4. Shows final pipeline summary for confirmation
5. Optionally shows alert configuration

**Example usage:**
User: "Set up a pipeline for my PostgreSQL database at localhost"
You: Call start_cdc_pipeline_setup with host, database, username
→ User fills in password securely via UI form
→ User selects tables they want to sync
→ User chooses destination (ClickHouse/Kafka)
→ User confirms final configuration
→ Pipeline created!

### 2. start_alert_setup
Use this when a user wants to set up monitoring alerts.
This initiates an interactive workflow:
1. Shows alert type selector (gap detection, volume spike, etc.)
2. Shows threshold configuration
3. Shows schedule picker (days/hours)
4. Shows recipient email input
5. Creates alert with user-confirmed settings

## Tool Descriptions

### Marketing Analytics Tools:
- list_available_connectors - Show supported marketing data sources
- check_connector_status - Check if a marketing source is connected
- initiate_oauth - Start OAuth authorization for marketing sources
- create_kafka_pipeline - Start real-time streaming from marketing sources
- generate_dashboard - Create dashboard from processed marketing data

### CDC Read-Only Tools (for information gathering):
- discover_schema - Explore database tables and columns
- check_cdc_readiness - Validate PostgreSQL configuration
- preview_sample_data - Preview data from a table
- list_cdc_pipelines - List existing pipelines
- get_pipeline_status - Check pipeline health

### Pipeline Control Tools:
- control_cdc_pipeline - Pause, resume, or stop a pipeline
- list_alert_rules - List configured alert rules
- test_alert - Send test alert notification

## What Makes You Special
You create enterprise-grade streaming infrastructure:

### Marketing Data Sources (OAuth-based)
- Google Ads, Facebook Ads, Shopify (coming soon)
- Kafka for real-time streaming
- Flink for continuous metric calculations (ROAS, CPC, CTR)
- Live dashboards that update automatically

### Database CDC Sources (PostgreSQL)
- Change Data Capture from PostgreSQL databases
- Real-time database replication via Debezium
- Schema discovery and validation
- Sink to ClickHouse for analytics

## Response Style
- Be friendly and guide users through each step
- Explain what each confirmation form is for
- Never rush through the workflow - let users make decisions
- Celebrate successful completions
- If user provides all info upfront, still use the interactive tools

## Example Conversation Flow

User: "Connect my Postgres database at db.example.com to ClickHouse"

You: "I'll help you set up a CDC pipeline to sync your PostgreSQL data to ClickHouse! Let me gather your connection details."
[Call start_cdc_pipeline_setup with host="db.example.com"]

Response shows: "Please enter your database password securely below"
[User fills in the secure credential form]

Response shows: "Found 10 tables. Please select which ones to sync"
[User selects tables via checkboxes]

Response shows: "Choose your destination"
[User selects ClickHouse]

Response shows: "Review your pipeline configuration"
[User confirms creation]

You: "Pipeline created successfully! Would you like to set up alerts?"

## Important Reminders
- ALWAYS use start_cdc_pipeline_setup for new database connections
- ALWAYS use start_alert_setup for new alert configurations
- NEVER ask for passwords in chat - the secure form handles it
- NEVER auto-execute without user confirmation on destructive actions
- User feedback from UI forms comes back automatically - you don't need to poll"""

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

            # Debug: Print all messages
            print(f"[DEBUG] Total messages from agent: {len(output_messages)}")
            for i, msg in enumerate(output_messages):
                msg_type = getattr(msg, 'type', 'unknown')
                msg_content = getattr(msg, 'content', '')[:200] if hasattr(msg, 'content') else 'no content'
                print(f"[DEBUG] Message {i}: type={msg_type}, content={msg_content}...")
            content = "I'm sorry, I couldn't process that request."
            tool_outputs = []

            # First, collect tool outputs and find AI response
            for msg in output_messages:
                msg_type = getattr(msg, 'type', None)
                if msg_type == 'tool' and hasattr(msg, 'content') and msg.content:
                    tool_outputs.append(msg.content)

            # Get the final AI message
            for msg in reversed(output_messages):
                if hasattr(msg, 'content') and msg.content:
                    msg_type = getattr(msg, 'type', None)
                    if msg_type == 'tool':
                        continue
                    content = msg.content
                    break

            # Extract actions - first check tool outputs (primary source), then AI response
            actions = []

            print(f"[DEBUG] Tool outputs collected: {len(tool_outputs)}")
            for i, to in enumerate(tool_outputs):
                print(f"[DEBUG] Tool output {i}: {to[:300]}...")

            # Check tool outputs for actions first
            for tool_output in tool_outputs:
                actions = self._extract_actions(tool_output)
                if actions:
                    print(f"[DEBUG] Actions extracted from tool output: {actions}")
                    break

            # If no actions from tools, check AI response
            if not actions:
                actions = self._extract_actions(content)
                print(f"[DEBUG] Actions extracted from AI content: {actions}")

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

    def _extract_json_object(self, content: str, start_idx: int) -> str:
        """Extract a complete JSON object with balanced braces starting at start_idx"""
        if start_idx >= len(content) or content[start_idx] != '{':
            return ""

        depth = 0
        in_string = False
        escape_next = False

        for i in range(start_idx, len(content)):
            char = content[i]

            if escape_next:
                escape_next = False
                continue

            if char == '\\':
                escape_next = True
                continue

            if char == '"' and not escape_next:
                in_string = not in_string
                continue

            if in_string:
                continue

            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    return content[start_idx:i+1]

        return ""

    def _extract_actions(self, content: str) -> List[Dict[str, Any]]:
        """Extract UI actions from agent response content"""
        actions = []

        content_lower = content.lower()

        # Check for new interactive confirmation actions (highest priority)
        confirmation_types = [
            ('confirm_source_select', 'sourceContext'),
            ('confirm_credentials', 'credentialContext'),
            ('confirm_tables', 'tableContext'),
            ('confirm_destination', 'destinationContext'),
            ('confirm_pipeline_create', 'pipelineContext'),
            ('confirm_alert_config', 'alertContext'),
            ('confirm_action', 'actionContext'),
        ]

        for action_type, context_key in confirmation_types:
            action_marker = f'"action_type": "{action_type}"'
            if action_marker in content:
                try:
                    # Find the start of the JSON object containing this action
                    marker_idx = content.find(action_marker)
                    # Search backwards to find the opening brace
                    start_idx = content.rfind('{', 0, marker_idx)
                    if start_idx != -1:
                        json_str = self._extract_json_object(content, start_idx)
                        if json_str:
                            data = json.loads(json_str)
                            context_data = data.get(context_key) or data.get('credentialContext') or data.get('alertContext')

                            if context_data:
                                action = {
                                    "type": action_type,
                                    "label": action_type.replace('confirm_', '').replace('_', ' ').title(),
                                }
                                # Add context with camelCase key
                                action[context_key] = context_data
                                actions.append(action)
                                return actions  # One confirmation at a time
                except (json.JSONDecodeError, AttributeError) as e:
                    print(f"Error parsing {action_type} action: {e}")
                    pass

        # Check for confirm_reprocess action (legacy)
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
