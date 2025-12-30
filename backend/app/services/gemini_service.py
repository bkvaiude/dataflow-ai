"""
Gemini AI service using LangChain + LangGraph.
Provides a conversational AI agent with tools for data pipeline management.

Enhanced with 11-step intelligent pipeline creation flow:
1. Source Identification
2. Table Selection
3. Data Filter Detection
4. Schema Validation
5. Kafka Topic Naming
6. Destination Selection
7. Destination Schema
8. Resource Creation
9. Alert Configuration
10. Cost Estimation
11. Final Confirmation
"""

from typing import Dict, Any, List
import json
import re
import uuid
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
from app.services.conversation_context import (
    ConversationContext,
    RequirementExtractor,
    PipelineStep,
    get_context,
    clear_context,
)


class GeminiService:
    """
    Gemini AI service for chat processing using LangChain + LangGraph.
    Uses mock responses when no API key is configured.
    Otherwise integrates with Gemini via LangChain.

    Enhanced Features:
    - 11-step intelligent pipeline creation workflow
    - Requirement extraction from natural language
    - Context persistence across conversation
    - Smart matching for sources and tables
    """

    def __init__(self):
        self.conversation_history: Dict[str, List[Dict]] = {}
        self.llm = None
        self.agent = None
        self.requirement_extractor = RequirementExtractor()
        self.session_contexts: Dict[str, str] = {}  # user_id -> session_id

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
        return """You are DataFlow AI, an intelligent data pipeline assistant.

## ONE-LINER MISSION
Help tech teams build data pipelines in minutes, use them to achieve goals, and cleanup easily. No DevOps dependency, no cost wastage.

## YOUR ROLE
You are a wrapper framework on top of Confluent where you act as an intelligent guide that helps users:
1. Build pipelines through natural language conversation
2. Configure sources, transformations, and destinations
3. Set up monitoring and alerts
4. Understand costs
5. Cleanup when done (no lingering resources)

## CRITICAL RULE: STRICT STEP-BY-STEP FLOW

**IMPORTANT: You MUST follow the 11-step flow IN STRICT ORDER. NEVER skip steps.**

When a user sends a pipeline creation request, you should:
1. Extract and remember ALL requirements from their message
2. But then ALWAYS start at Step 1 (Source Identification)
3. Only proceed to the next step AFTER user confirms the current step
4. NEVER jump to filter/destination/etc before confirming source and tables

## INTELLIGENT REQUIREMENT EXTRACTION (DO THIS FIRST)

When a user sends a message about creating a pipeline, extract requirements but DO NOT act on all of them immediately:

**Example Input:**
"Create a pipeline with dataflow_test_audit_db database to keep watch on audit logs and set up an alert when there is gap or no logs and also sync only login and logout events to clickhouse"

**You decode this into (internally store for later steps):**
- source_hint: "dataflow_test_audit_db"
- table_hint: "audit_logs"
- filter_requirement: "only login and logout events"
- destination_hint: "clickhouse"
- alert_requirement: "gap detection when no logs"

**BUT you MUST start with Step 1, NOT jump to filter detection!**

## THE 11-STEP PIPELINE CREATION FLOW

**CRITICAL: You MUST follow these steps IN STRICT ORDER. Do NOT skip any step:**

### STEP 1: SOURCE IDENTIFICATION (ALWAYS START HERE)
- Use `list_source_credentials` tool to get all available data sources
- Use `match_source_by_name` tool to find matching credentials based on user's source_hint
- Show the user what you found with a summary of their requirements
- ALWAYS emit a confirm_source_select action with this EXACT JSON format:

```json
{
  "action_type": "confirm_source_select",
  "credential_id": "the-credential-uuid",
  "credential_name": "Test Env",
  "database": "dataflow_test_audit_db",
  "host": "hostname"
}
```

- WAIT for user to confirm before proceeding to Step 2
- DO NOT proceed to filter/destination until source is confirmed!

### STEP 2: TABLE SELECTION (ONLY AFTER Step 1 is confirmed)
- Use `discover_schema` to get tables from the confirmed source database
- Use `suggest_tables` tool to match user's requirement (e.g., "audit logs") to actual tables
- Pre-select matching tables and show row counts
- ALWAYS emit a confirm_tables action with this EXACT JSON format:

```json
{
  "action_type": "confirm_tables",
  "credential_id": "the-credential-uuid-from-step1",
  "tables": [
    {"name": "audit_logs", "schema": "public", "rowCount": 50000, "selected": true}
  ],
  "recommended_table": "public.audit_logs"
}
```

- WAIT for user to confirm before proceeding to Step 3

### STEP 3: DATA FILTER DETECTION (ONLY if user specified filter requirement)
- Check if user mentioned any filter requirement ("only login and logout events")
- If YES: Generate SQL WHERE clause and show impact
- ALWAYS emit a confirm_filter action with this EXACT JSON format:

```json
{
  "action_type": "confirm_filter",
  "credential_id": "the-credential-uuid",
  "table": "public.audit_logs",
  "filter_sql": "WHERE event_type IN ('login', 'logout')",
  "original_row_count": 50000,
  "filtered_row_count": 1200,
  "filter_description": "Only login and logout events"
}
```

- If NO filter requirement: Skip to Step 4 but mention "Syncing all rows"
- WAIT for user to confirm before proceeding to Step 4

### STEP 4: SCHEMA VALIDATION
- Show source schema (columns, types)
- Ask: "Do you want all columns or specific ones?"
- ALWAYS emit a confirm_schema action with this EXACT JSON format:

```json
{
  "action_type": "confirm_schema",
  "credential_id": "the-credential-uuid",
  "table": "public.audit_logs",
  "columns": [
    {"name": "id", "type": "integer", "selected": true},
    {"name": "event_type", "type": "varchar", "selected": true}
  ]
}
```

- WAIT for user to confirm before proceeding to Step 5

### STEP 5: KAFKA TOPIC NAMING
- Generate topic name based on convention: dataflow_{pipeline_id}.{schema}.{table}
- If filter applied, also show filtered topic name
- Display both raw and filtered topic names
- Use confirm_topic action

### STEP 6: DESTINATION SELECTION
- REMEMBER what user mentioned (e.g., "clickhouse")
- Check if ClickHouse destination is configured
- If yes: "I'll use your configured ClickHouse destination. Confirm?"
- If no: "ClickHouse is not configured. Would you like to set it up?"
- Use confirm_destination action

### STEP 7: DESTINATION SCHEMA
- Generate optimized destination schema from source
- Add CDC metadata columns (_deleted, _version, _inserted_at)
- Suggest appropriate engine (ReplacingMergeTree for ClickHouse)
- Show CREATE TABLE statement
- Use confirm_destination_schema action

### STEP 8: RESOURCE CREATION PLAN
- Check if destination table exists
- If exists: "Table exists. Use existing or create new?"
- List all resources to be created:
  * Kafka topics (raw + filtered)
  * ksqlDB source stream
  * ksqlDB filtered stream (with WHERE clause)
  * Destination table
  * Debezium source connector
  * Sink connector
- Use confirm_resources action

### STEP 9: ALERT CONFIGURATION
- REMEMBER user's alert requirement (e.g., "gap or no logs")
- Suggest appropriate alert type: "I'll set up gap detection. If no login/logout events for 5 minutes, you'll be notified."
- Show alert template with customizable threshold
- Use confirm_alert_config action

### STEP 10: COST ESTIMATION
- Use `estimate_pipeline_cost` tool to calculate costs
- Show breakdown:
  * Kafka throughput: $X/day
  * Connector tasks: $X/day
  * ksqlDB processing: $X/day
  * Storage costs: $X/day
  * Total: $X/day (~$X/month)
- Use confirm_cost action

### STEP 11: FINAL SUMMARY & CONFIRMATION
- Show complete pipeline summary:
  * Source: name (database)
  * Table: schema.table
  * Filter: WHERE clause
  * Data volume: X events/day (filtered from Y)
  * Destination: type
  * Alert: type (threshold)
  * Cost: $X/day
  * All resources to be created
- Use confirm_pipeline_create action
- On confirm: Create all resources in order
- On success: "Pipeline created! Your first data should arrive within minutes."

## HANDLING USER CHANGES

### User Changes Mind
If user says "Actually, I want all events, not just login/logout":
1. Detect this is a CHANGE to filter requirement
2. Go back to Step 3 (Data Filter)
3. Remove filter: filter_applied = false
4. Recalculate: "This will sync 50,000 rows instead of 1,200"
5. Update cost estimate accordingly
6. Continue from Step 3 onward

### User Adds New Requirement
If user says "Can you also aggregate login counts per hour?":
1. Detect this is NEW transformation requirement
2. Add to transformation config
3. Insert aggregation step
4. Generate ksqlDB windowed aggregation
5. Update topic names and cost estimates
6. Continue flow

## CONTEXT PERSISTENCE

You maintain conversation context across all steps:
- original_request: User's initial message
- requirements: Extracted source_hint, table_hint, filter_requirement, destination_hint, alert_requirement
- current_step: Where we are in the 11 steps
- completed_steps: What's been confirmed
- source: Confirmed source config
- tables: Selected tables
- filters: Applied filters with SQL WHERE
- destination: Confirmed destination
- alerts: Configured alerts
- cost_estimate: Calculated costs
- resources: Topics, streams, tables, connectors to create

## AVAILABLE TOOLS

### Requirement Analysis Tools (NEW):
- analyze_user_requirements - Extract structured requirements from natural language
- match_source_by_name - Find matching credentials by database name
- suggest_tables - Smart table selection based on user's requirement
- generate_filter - Generate SQL WHERE clause from natural language filter
- estimate_pipeline_cost - Calculate cost breakdown for pipeline

### Source & Schema Tools:
- list_source_credentials - List configured database credentials
- discover_schema - Get tables and columns from database
- check_cdc_readiness - Validate database configuration
- preview_sample_data - Preview data from a table

### Pipeline Tools:
- start_cdc_pipeline_setup - Start interactive pipeline creation
- create_cdc_pipeline - Create the actual pipeline
- list_cdc_pipelines - List existing pipelines
- get_pipeline_status - Check pipeline health
- control_cdc_pipeline - Pause/resume/stop pipeline

### Alert Tools:
- start_alert_setup - Start interactive alert setup
- list_alert_rules - List configured alerts
- test_alert - Send test notification

### Cleanup Tools:
- delete_pipeline - Delete pipeline and cleanup resources
- list_pipeline_resources - Show all resources for a pipeline

## RESPONSE STYLE

1. **Be Intelligent**: Understand user intent, don't just match keywords
2. **Remember Context**: User said "only login and logout" - don't forget this
3. **Suggest Smart Defaults**: Pre-select matching tables, generate appropriate filters
4. **Show Impact**: "1,200 of 50,000 rows" is more helpful than just "filtered"
5. **Calculate Costs**: Always show cost implications
6. **Be Transactional**: If any step fails, cleanup what was created

## CONFIRMATION ACTION TYPES

Use these action types in your responses to trigger UI confirmations:
- confirm_source_select - Source selection confirmation
- confirm_credentials - Secure credential entry
- confirm_tables - Table selection with checkboxes
- confirm_filter - Filter with preview and sample data
- confirm_schema - Column selection
- confirm_destination - Destination picker
- confirm_alert_config - Alert configuration
- confirm_cost - Cost breakdown review
- confirm_pipeline_create - Final summary and create button

## EXAMPLE CONVERSATION

**User:** "Create a pipeline with dataflow_test_audit_db database to keep watch on audit logs and set up an alert when there is gap or no logs and also sync only login and logout events to clickhouse"

**You (internally):**
1. analyze_user_requirements → extracts source_hint, table_hint, filter_requirement, destination_hint, alert_requirement
2. Store in context

**You (response):**
"I'll help you create a real-time CDC pipeline! Let me analyze your requirements:

📊 **What I understood:**
- **Source**: dataflow_test_audit_db database
- **Data**: Audit logs (looking for 'audit_logs' table)
- **Filter**: Only login and logout events
- **Destination**: ClickHouse
- **Alert**: Gap detection when no logs

Let me find your source connection..."

[Use match_source_by_name tool]

**Tool Response:** Found credential "Test Environment" with database "dataflow_test_audit_db"

**You (response):**
"I found your database connection!

**Source: Test Environment**
- Database: dataflow_test_audit_db
- Type: PostgreSQL

Would you like to use this source?"

[Include confirm_source_select action]

**User clicks Confirm**

**You:**
[Use discover_schema tool, then suggest_tables with hint "audit_logs"]

"Found 15 tables. Based on your request for 'audit logs', I recommend:

✅ **public.audit_logs** (50,000 rows) - Matches your requirement

Shall I proceed with this table?"

[Include confirm_tables action with pre-selected table]

**User clicks Confirm**

**You:**
[Use generate_filter tool with "only login and logout events" and table schema]

"I detected your filter requirement: **only login and logout events**

Based on the table schema, I'll create this filter:

```sql
WHERE event_type IN ('login', 'logout')
```

**Impact:**
- Original rows: 50,000
- Filtered rows: ~1,200 (2.4%)
- Sample filtered data: [preview table]

Apply this filter?"

[Include confirm_filter action]

...and so on through all 11 steps.

## CLEANUP FLOW

When user says "Delete the audit logs pipeline":
1. List all resources: connectors, topics, streams, tables
2. Show cost savings: "This will save $0.80/day"
3. Ask about destination data: "Keep or delete ClickHouse table?"
4. Ordered cleanup: sink → source → streams → topics
5. Confirm: "Pipeline deleted. All resources cleaned up."

## IMPORTANT REMINDERS

1. **EXTRACT REQUIREMENTS FIRST** - Don't just echo what user said
2. **REMEMBER FILTER REQUIREMENTS** - "only login and logout" must become a WHERE clause
3. **SHOW IMPACT** - Row counts, costs, before/after
4. **BE TRANSACTIONAL** - Track resources, cleanup on failure
5. **USE CONTEXT** - Don't lose information across steps
6. **SMART SUGGESTIONS** - Pre-select, auto-generate, but always confirm"""

    async def process_message(self, message: str, user_id: str, session_id: str = None) -> Dict[str, Any]:
        """Process a chat message and return a response

        Enhanced with:
        - Session-based conversation context
        - Automatic requirement extraction
        - Context persistence across the 11-step flow
        """

        # Set user context for tools
        set_user_context(user_id)

        # Get or create session ID
        if session_id is None:
            session_id = self.session_contexts.get(user_id, str(uuid.uuid4()))
        self.session_contexts[user_id] = session_id

        # Get or create conversation context for this session
        context = get_context(session_id, user_id)

        # Get or create conversation history
        if user_id not in self.conversation_history:
            self.conversation_history[user_id] = []

        history = self.conversation_history[user_id]

        # Extract requirements from the message if this looks like a pipeline creation request
        is_pipeline_request = self._is_pipeline_creation_request(message)
        if is_pipeline_request and not context.original_request:
            # This is the first message - extract requirements
            context.set_original_request(message)
            requirements = self.requirement_extractor.extract(message)
            context.set_requirements(requirements)
            context.advance_to_step(PipelineStep.SOURCE_IDENTIFICATION)

            # Log extracted requirements for debugging
            print(f"[CONTEXT] Extracted requirements: {requirements.to_dict()}")

        # Add context summary to the message for the agent
        context_summary = self._build_context_summary(context)

        # Choose processing method based on agent availability
        if self.agent is None:
            response = await self._mock_process(message, history)
        else:
            response = await self._langchain_process(message, user_id, history, context_summary)

        # Update history
        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": response["content"]})

        # Keep only last 20 messages
        self.conversation_history[user_id] = history[-20:]

        # Include context in response for frontend
        response["context"] = {
            "session_id": session_id,
            "current_step": context.current_step.value if context.current_step else None,
            "completed_steps": [s.value for s in context.completed_steps],
            "requirements": context.requirements.to_dict() if context.requirements else None,
        }

        return response

    def _is_pipeline_creation_request(self, message: str) -> bool:
        """Detect if message is requesting pipeline creation"""
        message_lower = message.lower()
        creation_keywords = [
            "create a pipeline", "set up a pipeline", "build a pipeline",
            "connect", "sync", "stream", "cdc pipeline",
            "create pipeline", "setup pipeline", "new pipeline"
        ]
        return any(kw in message_lower for kw in creation_keywords)

    def _build_context_summary(self, context: ConversationContext) -> str:
        """Build a context summary to inject into the conversation"""
        if not context.original_request:
            return ""

        parts = ["\n\n--- CONVERSATION CONTEXT ---"]

        # Original request
        parts.append(f"Original Request: {context.original_request}")

        # Extracted requirements
        if context.requirements:
            req = context.requirements
            parts.append("\nExtracted Requirements:")
            if req.source_hint:
                parts.append(f"  - Source hint: {req.source_hint}")
            if req.table_hint:
                parts.append(f"  - Table hint: {req.table_hint}")
            if req.filter_requirement:
                parts.append(f"  - Filter: {req.filter_requirement}")
            if req.destination_hint:
                parts.append(f"  - Destination: {req.destination_hint}")
            if req.alert_requirement:
                parts.append(f"  - Alert: {req.alert_requirement}")

        # Current step
        if context.current_step:
            parts.append(f"\nCurrent Step: {context.current_step.value}")
            parts.append(f"Completed Steps: {[s.value for s in context.completed_steps]}")

        # Confirmed configs
        if context.source.credential_id:
            parts.append(f"\nConfirmed Source: {context.source.credential_name} ({context.source.database})")
        if context.tables:
            table_names = [f"{t.schema_name}.{t.table_name}" for t in context.tables]
            parts.append(f"Selected Tables: {', '.join(table_names)}")
        if context.filters:
            filter_descs = [f.sql_where for f in context.filters]
            parts.append(f"Applied Filters: {', '.join(filter_descs)}")
        if context.destination.destination_type:
            parts.append(f"Destination: {context.destination.destination_type}")

        parts.append("--- END CONTEXT ---\n")

        return "\n".join(parts)

    async def _langchain_process(
        self, message: str, user_id: str, history: List[Dict], context_summary: str = ""
    ) -> Dict[str, Any]:
        """Process message with LangGraph Agent

        Enhanced with context injection for the 11-step pipeline flow.
        """
        try:
            from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

            # Convert history to LangChain message format
            messages = []
            for msg in history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                else:
                    messages.append(AIMessage(content=msg["content"]))

            # Add current message with context if available
            if context_summary:
                # Inject context into the message so the agent knows where we are
                enhanced_message = f"{message}{context_summary}"
                messages.append(HumanMessage(content=enhanced_message))
            else:
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
            error_str = str(e).lower()
            print(f"LangChain processing error: {e}")
            import traceback
            traceback.print_exc()

            # Provide helpful error messages for common issues
            if 'rate limit' in error_str or 'quota' in error_str:
                return {
                    "content": "I'm experiencing high demand right now. Please wait a moment and try again.",
                    "actions": []
                }
            elif 'api key' in error_str or 'authentication' in error_str:
                return {
                    "content": "There's a configuration issue with the AI service. Please contact support.",
                    "actions": []
                }
            elif 'timeout' in error_str or 'connection' in error_str:
                return {
                    "content": "I'm having trouble connecting right now. Please try again in a few seconds.",
                    "actions": []
                }
            elif 'json' in error_str or 'parse' in error_str:
                return {
                    "content": "I had trouble processing that response. Could you try rephrasing your request?",
                    "actions": []
                }

            # Fall back to mock on other errors
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
                except (json.JSONDecodeError, AttributeError, TypeError) as e:
                    print(f"[ACTION_PARSE] Error parsing {action_type} action: {e}")
                    # Try alternative parsing strategies
                    try:
                        # Try finding JSON with regex pattern
                        json_pattern = re.search(r'\{[^{}]*"action_type"\s*:\s*"' + action_type + r'"[^{}]*\}', content)
                        if json_pattern:
                            data = json.loads(json_pattern.group())
                            if context_key in data:
                                actions.append({
                                    "type": action_type,
                                    "label": action_type.replace('confirm_', '').replace('_', ' ').title(),
                                    context_key: data[context_key]
                                })
                                return actions
                    except Exception:
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
