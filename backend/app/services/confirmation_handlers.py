"""
Confirmation Handlers for Interactive Chat Flow

This module processes confirmations from the frontend UI components
and executes the appropriate backend actions.
"""

from typing import Dict, Any, List, Optional
import json
import uuid
from datetime import datetime

from app.services.credential_service import credential_service
from app.services.schema_discovery_service import schema_discovery_service
from app.services.cdc_readiness_service import cdc_readiness_service
from app.db.models import Pipeline
from app.services.db_service import db_service
from app.services.alert_service import alert_service
from app.services.conversation_context import get_context
from app.services.filter_generator import filter_generator
from app.services.cost_estimator import cost_estimator


class ConfirmationHandlers:
    """Handles confirmation responses from interactive chat UI"""

    def __init__(self):
        # Store workflow session state
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def _get_session(self, session_id: str) -> Dict[str, Any]:
        """Get or create a workflow session"""
        if session_id not in self._sessions:
            self._sessions[session_id] = {
                'created_at': datetime.utcnow().isoformat(),
                'steps_completed': []
            }
        return self._sessions[session_id]

    def _clear_session(self, session_id: str):
        """Clear a workflow session"""
        if session_id in self._sessions:
            del self._sessions[session_id]

    async def handle_source_selection(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process source selection.

        User either selected an existing credential or chose to create a new one.
        This is Step 1 of the pipeline creation flow.
        """
        if data.get('cancelled'):
            return {
                'message': "No problem! Let me know when you're ready to set up a CDC pipeline.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        # BRIDGE: Copy AI requirements from ConversationContext to handler session
        try:
            # Try to find context by session_id first, then search all contexts for user_id
            from app.services.conversation_context import get_all_contexts
            ai_context = None

            # First try direct lookup
            ai_context = get_context(session_id, user_id)
            print(f"[CONTEXT_BRIDGE] Direct lookup for session_id={session_id}, user_id={user_id}")

            # If no requirements, search all contexts for this user
            if not ai_context or not ai_context.requirements or not ai_context.requirements.filter_requirement:
                print(f"[CONTEXT_BRIDGE] Direct lookup failed, searching all contexts...")
                all_contexts = get_all_contexts()
                for ctx_id, ctx in all_contexts.items():
                    if ctx.user_id == user_id and ctx.requirements:
                        print(f"[CONTEXT_BRIDGE] Found context {ctx_id} for user {user_id}")
                        if ctx.requirements.filter_requirement:
                            ai_context = ctx
                            print(f"[CONTEXT_BRIDGE] Found filter_requirement in context {ctx_id}: {ctx.requirements.filter_requirement}")
                            break

            if ai_context and ai_context.requirements:
                if ai_context.requirements.filter_requirement:
                    session['filter_requirement'] = ai_context.requirements.filter_requirement
                    print(f"[CONTEXT_BRIDGE] Copied filter_requirement: {session['filter_requirement']}")
                if ai_context.requirements.alert_requirement:
                    session['alert_requirement'] = ai_context.requirements.alert_requirement
                if ai_context.requirements.destination_hint:
                    session['destination_hint'] = ai_context.requirements.destination_hint
                if ai_context.requirements.table_hint:
                    session['table_hint'] = ai_context.requirements.table_hint
            else:
                print(f"[CONTEXT_BRIDGE] No AI context found with requirements")
        except Exception as e:
            import traceback
            print(f"[CONTEXT_BRIDGE] Warning: Could not bridge context: {e}")
            traceback.print_exc()

        # Check if user wants to create new source
        if data.get('createNew'):
            return {
                'message': "I've opened the Data Sources page in a new tab. Once you've added your new data source there, come back here and say 'set up pipeline' to continue!",
                'actions': []
            }

        # User selected an existing credential
        credential_id = data.get('credentialId') or data.get('credential_id')
        credential_name = data.get('credentialName') or data.get('credential_name') or data.get('name')
        host = data.get('host')
        database = data.get('database')

        if not credential_id:
            return {
                'message': "Please select a data source to continue.",
                'actions': []
            }

        print(f"[SOURCE_SELECT] Storing credential_id: {credential_id}, name: {credential_name}, database: {database}")

        # Store credential info in session
        session['credential_id'] = credential_id
        session['credential_name'] = credential_name
        session['host'] = host
        session['database'] = database
        session['steps_completed'].append('source_selected')

        try:
            # Discover schema
            schema_result = schema_discovery_service.discover(
                user_id=user_id,
                credential_id=credential_id,
                schema_filter='public',
                include_row_counts=True
            )

            # Prepare table list for selection
            tables = []
            for table in schema_result.get('tables', []):
                tables.append({
                    'name': table.get('table_name'),
                    'schema': table.get('schema_name', 'public'),
                    'rowCount': table.get('row_count_estimate', 0),
                    'cdcEligible': table.get('cdc_eligible', True),
                    'issues': table.get('cdc_issues', [])
                })

            # Return table selection action
            return {
                'message': f"Using '{credential_name}'. I found {len(tables)} tables in your database. Please select which tables you'd like to sync:",
                'actions': [{
                    'type': 'confirm_tables',
                    'label': 'Select Tables',
                    'tableContext': {
                        'credentialId': credential_id,
                        'credentialName': credential_name,
                        'tables': tables,
                        'recommendedTables': [],
                        'sessionId': session_id
                    }
                }]
            }

        except Exception as e:
            return {
                'message': f"Failed to discover tables: {str(e)}. Please check your data source configuration.",
                'actions': []
            }

    async def handle_credential_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process secure credential form submission.

        After successful credential storage, returns table selection action.
        """
        if data.get('cancelled'):
            return {
                'message': "No problem! Let me know when you're ready to set up your database connection.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        try:
            # Store credentials
            credentials_dict = {
                'host': data.get('host'),
                'port': data.get('port', 5432),
                'database': data.get('database'),
                'username': data.get('username'),
                'password': data.get('password')
            }

            result = credential_service.store_credentials(
                user_id=user_id,
                name=data.get('name', f"Connection {datetime.now().strftime('%Y%m%d_%H%M%S')}"),
                source_type=data.get('sourceType', 'postgresql'),
                credentials=credentials_dict,
                test_connection=data.get('testConnection', True)
            )

            if not result.get('is_valid'):
                return {
                    'message': f"Connection test failed. Please check your credentials and try again.\n\nError: {result.get('error', 'Unknown error')}",
                    'actions': [{
                        'type': 'confirm_credentials',
                        'label': 'Try Again',
                        'credentialContext': {
                            'name': data.get('name'),
                            'sourceType': data.get('sourceType', 'postgresql'),
                            'host': data.get('host'),
                            'port': data.get('port', 5432),
                            'database': data.get('database'),
                            'username': data.get('username'),
                            'sessionId': session_id
                        }
                    }]
                }

            # Store credential info in session
            session['credential_id'] = result['id']
            session['credential_name'] = data.get('name')
            session['host'] = data.get('host')
            session['database'] = data.get('database')
            session['steps_completed'].append('credentials')

            # Discover schema
            schema_result = schema_discovery_service.discover(
                user_id=user_id,
                credential_id=result['id'],
                schema_filter='public',
                include_row_counts=True
            )

            # Prepare table list for selection
            tables = []
            for table in schema_result.get('tables', []):
                tables.append({
                    'name': table.get('table_name'),
                    'schema': table.get('schema_name', 'public'),
                    'rowCount': table.get('row_count_estimate', 0),
                    'cdcEligible': table.get('cdc_eligible', True),
                    'issues': table.get('cdc_issues', [])
                })

            # Return table selection action
            return {
                'message': f"Connection successful! I found {len(tables)} tables in your database. Please select which tables you'd like to sync:",
                'actions': [{
                    'type': 'confirm_tables',
                    'label': 'Select Tables',
                    'tableContext': {
                        'credentialId': result['id'],
                        'credentialName': data.get('name'),
                        'tables': tables,
                        'recommendedTables': [],
                        'sessionId': session_id
                    }
                }]
            }

        except Exception as e:
            return {
                'message': f"Failed to store credentials: {str(e)}",
                'actions': []
            }

    async def handle_table_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process table selection.

        After tables are selected, check for filter requirement or proceed to destination.
        """
        if data.get('cancelled'):
            session_id = data.get('sessionId')
            if session_id:
                self._clear_session(session_id)
            return {
                'message': "Pipeline setup cancelled. Let me know if you'd like to start over.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        selected_tables = data.get('selectedTables', [])
        credential_id = data.get('credentialId')

        if not selected_tables:
            return {
                'message': "Please select at least one table to continue.",
                'actions': []
            }

        # Store selection in session
        session['selected_tables'] = selected_tables
        session['credential_id'] = credential_id
        session['steps_completed'].append('tables')

        # Check if there's a filter requirement stored in session (from AI context)
        filter_requirement = session.get('filter_requirement')
        if filter_requirement:
            print(f"[FILTER_FLOW] Detected filter requirement: {filter_requirement}")

            # Get table schema for filter generation
            try:
                schema_result = schema_discovery_service.discover(
                    user_id=user_id,
                    credential_id=credential_id,
                    schema_filter='public',
                    include_row_counts=True
                )

                # Find the selected table's columns
                table_columns = []
                table_row_count = 0
                for table in schema_result.get('tables', []):
                    full_name = f"{table.get('schema_name')}.{table.get('table_name')}"
                    if full_name == selected_tables[0]:
                        table_columns = [
                            {
                                'name': col.get('column_name'),
                                'type': col.get('data_type'),
                                'nullable': col.get('is_nullable', True)
                            }
                            for col in table.get('columns', [])
                        ]
                        table_row_count = table.get('row_count_estimate', 0)
                        break

                # Generate filter using the filter_generator
                if table_columns:
                    filter_config = filter_generator.generate(
                        requirement=filter_requirement,
                        columns=table_columns
                    )

                    print(f"[FILTER_FLOW] Generated filter: {filter_config.sql_where}")

                    # Get filter preview (filtered count and sample data)
                    filtered_count = 0
                    sample_data = []
                    try:
                        # Parse table name to get schema and table
                        table_parts = selected_tables[0].split('.')
                        schema_name = table_parts[0] if len(table_parts) > 1 else 'public'
                        table_only = table_parts[-1]

                        preview_result = schema_discovery_service.get_filter_preview(
                            user_id=user_id,
                            credential_id=credential_id,
                            schema_name=schema_name,
                            table_name=table_only,
                            filter_sql=filter_config.sql_where,
                            limit=5
                        )
                        filtered_count = preview_result.get('filtered_count', 0)
                        sample_data = preview_result.get('sample_data', [])
                        print(f"[FILTER_FLOW] Preview: {filtered_count} rows match filter")
                    except Exception as preview_err:
                        print(f"[FILTER_FLOW] Preview error (non-fatal): {preview_err}")

                    # Return filter confirmation action
                    return {
                        'message': f"Great! You've selected {len(selected_tables)} table(s). I detected your filter requirement: \"{filter_requirement}\"",
                        'actions': [{
                            'type': 'confirm_filter',
                            'label': 'Review Filter',
                            'filterContext': {
                                'credentialId': credential_id,
                                'table': selected_tables[0],
                                'filterSql': filter_config.sql_where,
                                'filterColumn': filter_config.column,
                                'filterOperator': filter_config.operator,
                                'filterValues': filter_config.values,
                                'filterDescription': filter_requirement,
                                'confidence': filter_config.confidence,
                                'originalRowCount': table_row_count,
                                'filteredRowCount': filtered_count,
                                'sampleData': sample_data,
                                'tableColumns': table_columns,
                                'sessionId': session_id
                            }
                        }]
                    }
            except Exception as e:
                print(f"[FILTER_FLOW] Error generating filter: {e}")
                # Fall through to destination selection if filter generation fails

        # Return destination selection action
        return {
            'message': f"Great! You've selected {len(selected_tables)} table(s). Now, where would you like to sync this data?",
            'actions': [{
                'type': 'confirm_destination',
                'label': 'Choose Destination',
                'destinationContext': {
                    'credentialId': credential_id,
                    'selectedTables': selected_tables,
                    'destinations': [
                        {
                            'type': 'clickhouse',
                            'name': 'ClickHouse',
                            'description': 'Fast analytics database for real-time queries and dashboards',
                            'available': True,
                            'recommended': True
                        },
                        {
                            'type': 'kafka',
                            'name': 'Kafka Topic',
                            'description': 'Stream to Kafka for custom downstream processing',
                            'available': True,
                            'recommended': False
                        },
                        {
                            'type': 's3',
                            'name': 'Amazon S3',
                            'description': 'Store in S3 for data lake integration',
                            'available': False,
                            'recommended': False
                        }
                    ],
                    'sessionId': session_id
                }
            }]
        }

    async def handle_filter_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process filter confirmation.

        After filter is confirmed, proceed to schema validation or destination.
        """
        if data.get('cancelled'):
            session_id = data.get('sessionId')
            session = self._get_session(session_id) if session_id else {}
            # User wants no filter - proceed without filter
            session['filter_applied'] = False
            return {
                'message': "No filter applied. All rows will be synced. Proceeding to destination selection.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        # Store filter configuration
        filter_sql = data.get('filter_sql', data.get('filterSql', ''))
        session['filter_sql'] = filter_sql
        session['filter_applied'] = True
        session['filtered_row_count'] = data.get('filtered_row_count', data.get('filteredRowCount', 0))
        session['steps_completed'].append('filter')

        credential_id = session.get('credential_id') or data.get('credentialId')
        selected_tables = session.get('selected_tables', [])

        # Proceed to destination selection
        return {
            'message': f"Filter applied: `{filter_sql}`. Now, where would you like to sync this filtered data?",
            'actions': [{
                'type': 'confirm_destination',
                'label': 'Choose Destination',
                'destinationContext': {
                    'credentialId': credential_id,
                    'selectedTables': selected_tables,
                    'filterApplied': True,
                    'filterSql': filter_sql,
                    'destinations': [
                        {
                            'type': 'clickhouse',
                            'name': 'ClickHouse',
                            'description': 'Fast analytics database for real-time queries and dashboards',
                            'available': True,
                            'recommended': True
                        },
                        {
                            'type': 'kafka',
                            'name': 'Kafka Topic',
                            'description': 'Stream to Kafka for custom downstream processing',
                            'available': True,
                            'recommended': False
                        }
                    ],
                    'sessionId': session_id
                }
            }]
        }

    async def handle_schema_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process schema/column selection confirmation.

        After columns are selected, proceed to destination.
        """
        if data.get('cancelled'):
            return {
                'message': "Schema selection cancelled. Using all columns.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        # Store selected columns
        selected_columns = data.get('columns', data.get('selectedColumns', []))
        session['selected_columns'] = selected_columns
        session['steps_completed'].append('schema')

        credential_id = session.get('credential_id') or data.get('credentialId')
        selected_tables = session.get('selected_tables', [])

        # Proceed to destination selection
        return {
            'message': f"Schema confirmed with {len(selected_columns)} columns. Now, where would you like to sync this data?",
            'actions': [{
                'type': 'confirm_destination',
                'label': 'Choose Destination',
                'destinationContext': {
                    'credentialId': credential_id,
                    'selectedTables': selected_tables,
                    'selectedColumns': selected_columns,
                    'destinations': [
                        {
                            'type': 'clickhouse',
                            'name': 'ClickHouse',
                            'description': 'Fast analytics database for real-time queries and dashboards',
                            'available': True,
                            'recommended': True
                        },
                        {
                            'type': 'kafka',
                            'name': 'Kafka Topic',
                            'description': 'Stream to Kafka for custom downstream processing',
                            'available': True,
                            'recommended': False
                        }
                    ],
                    'sessionId': session_id
                }
            }]
        }

    async def handle_topic_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process Kafka topic naming confirmation.

        After topic is confirmed, proceed to destination schema or resources.
        """
        if data.get('cancelled'):
            return {
                'message': "Topic naming cancelled. Using default naming convention.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        # Store topic configuration
        topic_name = data.get('topic_name', data.get('topicName', ''))
        session['topic_name'] = topic_name
        session['steps_completed'].append('topic')

        return {
            'message': f"Kafka topic '{topic_name}' confirmed. Proceeding with destination configuration.",
            'actions': []
        }

    async def handle_cost_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process cost estimation confirmation.

        After cost is acknowledged, proceed to topic registry confirmation.
        """
        if data.get('cancelled'):
            session_id = data.get('sessionId')
            if session_id:
                self._clear_session(session_id)
            return {
                'message': "Pipeline setup cancelled. Let me know if you'd like to start over.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        # Store cost acknowledgement
        session['cost_acknowledged'] = True
        session['estimated_cost'] = data.get('estimated_cost', data.get('estimatedCost', {}))
        session['steps_completed'].append('cost')

        # Get stored values from session to proceed to topic registry
        credential_id = session.get('credential_id')
        selected_tables = session.get('selected_tables', [])
        clickhouse_config = session.get('clickhouse_config', {})
        approved_schema = session.get('approved_schema', {})
        topic_name = session.get('topic_name', '')
        avro_schema = session.get('avro_schema', {})
        schema_registry_subject = session.get('schema_registry_subject', '')

        # Return topic registry confirmation
        return {
            'message': f"Cost estimate confirmed. Here's how the data will flow from Kafka to ClickHouse:",
            'actions': [{
                'type': 'confirm_topic_registry',
                'label': 'Review Data Flow',
                'topicContext': {
                    'credentialId': credential_id,
                    'selectedTables': selected_tables,
                    'clickhouseConfig': clickhouse_config,
                    'approvedSchema': approved_schema,
                    'topicName': topic_name,
                    'avroSchema': avro_schema,
                    'schemaRegistrySubject': schema_registry_subject,
                    'sessionId': session_id
                }
            }]
        }

    async def handle_resources_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process resource creation plan confirmation.

        After resources are confirmed, proceed to alert configuration or final creation.
        """
        if data.get('cancelled'):
            return {
                'message': "Resource creation cancelled. Let me know when you're ready to proceed.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        # Store resource plan
        session['resources_confirmed'] = True
        session['resources_to_create'] = data.get('resources', [])
        session['steps_completed'].append('resources')

        return {
            'message': "Resource plan confirmed. Proceeding with pipeline creation.",
            'actions': []
        }

    async def handle_destination_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process destination selection.

        After destination is selected, routes to appropriate next step:
        - ClickHouse: Route to ClickHouse config
        - Kafka: Route to pipeline confirmation
        """
        if data.get('cancelled'):
            session_id = data.get('sessionId')
            if session_id:
                self._clear_session(session_id)
            return {
                'message': "Pipeline setup cancelled. Let me know if you'd like to start over.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        destination = data.get('destination', 'clickhouse')
        credential_id = data.get('credentialId')
        selected_tables = data.get('selectedTables', session.get('selected_tables', []))

        # Store in session
        session['sink_type'] = destination
        session['steps_completed'].append('destination')

        # Route to ClickHouse config if destination is ClickHouse
        if destination == 'clickhouse':
            from app.config import settings
            from app.services.clickhouse_service import clickhouse_service

            # Fetch existing ClickHouse tables for user to select from
            existing_tables = []
            try:
                tables = clickhouse_service.list_tables(settings.clickhouse_database)
                for table_name in tables:
                    try:
                        schema = clickhouse_service.get_table_schema(settings.clickhouse_database, table_name)
                        row_count = clickhouse_service.get_row_count(settings.clickhouse_database, table_name)
                        existing_tables.append({
                            'database': settings.clickhouse_database,
                            'table': table_name,
                            'columns': schema,
                            'rowCount': row_count
                        })
                    except Exception:
                        pass  # Skip tables we can't read
            except Exception as e:
                print(f"[CLICKHOUSE_CONFIG] Could not fetch existing tables: {e}")

            # Generate suggested table name from source table
            source_table = selected_tables[0].split('.')[-1] if selected_tables else 'events'
            suggested_table = f"{source_table}_cdc"

            return {
                'message': "Great! Now let's configure ClickHouse as your analytics destination. Choose an existing table or create a new one:",
                'actions': [{
                    'type': 'confirm_clickhouse_config',
                    'label': 'Configure ClickHouse',
                    'clickhouseContext': {
                        'credentialId': credential_id,
                        'selectedTables': selected_tables,
                        'sessionId': session_id,
                        'existingTables': existing_tables,
                        'suggestedDatabase': settings.clickhouse_database,
                        'suggestedTable': suggested_table
                    }
                }]
            }

        # For Kafka destination, go directly to pipeline confirmation
        table_hint = selected_tables[0].split('.')[-1] if selected_tables else 'data'
        suggested_name = f"{table_hint.title()} CDC Pipeline"

        return {
            'message': f"Excellent choice! Here's a summary of your pipeline configuration. Please review and confirm:",
            'actions': [{
                'type': 'confirm_pipeline_create',
                'label': 'Review Pipeline',
                'pipelineContext': {
                    'credentialId': credential_id,
                    'credentialName': session.get('credential_name', 'Database'),
                    'host': session.get('host', ''),
                    'database': session.get('database', ''),
                    'selectedTables': selected_tables,
                    'sinkType': destination,
                    'suggestedName': suggested_name,
                    'sessionId': session_id
                }
            }]
        }

    async def handle_pipeline_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process final pipeline creation.

        Creates the pipeline and optionally offers alert setup.
        """
        print(f"[PIPELINE_CREATE] Starting pipeline creation for user: {user_id}")
        print(f"[PIPELINE_CREATE] Data received: {data}")

        if data.get('cancelled'):
            session_id = data.get('sessionId')
            if session_id:
                self._clear_session(session_id)
            return {
                'message': "Pipeline creation cancelled. Let me know if you'd like to start over.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        try:
            # Create pipeline
            db_session = db_service._get_session()
            try:
                pipeline = Pipeline(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    name=data.get('pipelineName', 'CDC Pipeline'),
                    source_credential_id=data.get('credentialId'),
                    source_tables=data.get('selectedTables', []),
                    sink_type=data.get('sinkType', 'clickhouse'),
                    sink_config={},
                    status='pending'
                )
                db_session.add(pipeline)
                db_session.commit()
                db_session.refresh(pipeline)

                print(f"[PIPELINE_CREATE] Pipeline created successfully: id={pipeline.id}, user_id={pipeline.user_id}")

                # Store pipeline info in session
                session['pipeline_id'] = pipeline.id
                session['pipeline_name'] = pipeline.name
                session['steps_completed'].append('pipeline_created')

                # Offer alert setup
                return {
                    'message': f"Pipeline '{pipeline.name}' created successfully! Would you like to set up monitoring alerts for this pipeline?",
                    'actions': [{
                        'type': 'confirm_alert_config',
                        'label': 'Configure Alerts',
                        'alertContext': {
                            'pipelineId': pipeline.id,
                            'pipelineName': pipeline.name,
                            'suggestedName': f"{pipeline.name} Monitor",
                            'ruleTypes': [
                                {
                                    'type': 'gap_detection',
                                    'name': 'Gap Detection',
                                    'description': 'Alert when no events are received for a period',
                                    'recommended': True
                                },
                                {
                                    'type': 'volume_spike',
                                    'name': 'Volume Spike',
                                    'description': 'Alert when event volume exceeds baseline',
                                    'recommended': False
                                },
                                {
                                    'type': 'volume_drop',
                                    'name': 'Volume Drop',
                                    'description': 'Alert when event volume drops significantly',
                                    'recommended': False
                                },
                                {
                                    'type': 'null_ratio',
                                    'name': 'NULL Ratio',
                                    'description': 'Alert when NULL values exceed threshold',
                                    'recommended': False
                                }
                            ],
                            'defaultConfig': {
                                'severity': 'warning',
                                'enabledDays': [0, 1, 2, 3, 4],  # Mon-Fri
                                'enabledHours': {'start': 9, 'end': 17},
                                'cooldownMinutes': 30
                            },
                            'sessionId': session_id
                        }
                    }, {
                        'type': 'confirm_action',
                        'label': 'Skip Alerts',
                        'actionContext': {
                            'actionId': 'skip_alerts',
                            'title': 'Skip Alert Setup',
                            'description': 'You can always configure alerts later from the pipeline details page.',
                            'confirmLabel': 'Skip',
                            'cancelLabel': 'Go Back',
                            'variant': 'default',
                            'metadata': {'pipelineId': pipeline.id}
                        }
                    }]
                }

            except Exception as e:
                db_session.rollback()
                raise e
            finally:
                db_session.close()

        except Exception as e:
            return {
                'message': f"Failed to create pipeline: {str(e)}",
                'actions': []
            }

    async def handle_alert_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process alert configuration.

        Creates the alert rule and completes the workflow.
        """
        if data.get('cancelled'):
            session_id = data.get('sessionId')
            pipeline_id = data.get('pipelineId')
            if session_id:
                self._clear_session(session_id)
            return {
                'message': f"Alert setup skipped. Your pipeline is ready! You can configure alerts later from the pipeline details page.",
                'actions': [{
                    'type': 'link',
                    'url': f'/dashboard/pipelines/{pipeline_id}',
                    'label': 'View Pipeline'
                }]
            }

        session_id = data.get('sessionId')

        try:
            # Create alert rule
            rule = alert_service.create_rule(
                user_id=user_id,
                pipeline_id=data.get('pipelineId'),
                name=data.get('name', 'Pipeline Monitor'),
                rule_type=data.get('ruleType', 'gap_detection'),
                threshold_config=data.get('thresholdConfig', {'minutes': 5}),
                enabled_days=data.get('enabledDays', [0, 1, 2, 3, 4]),
                severity=data.get('severity', 'warning'),
                recipients=data.get('recipients', [])
            )

            # Clear session - workflow complete
            if session_id:
                self._clear_session(session_id)

            pipeline_id = data.get('pipelineId')

            return {
                'message': f"Alert '{rule['name']}' created successfully! Your pipeline is now fully configured with monitoring.",
                'actions': [{
                    'type': 'link',
                    'url': f'/dashboard/pipelines/{pipeline_id}',
                    'label': 'View Pipeline'
                }, {
                    'type': 'link',
                    'url': '/dashboard/alerts',
                    'label': 'View Alerts'
                }]
            }

        except Exception as e:
            return {
                'message': f"Failed to create alert: {str(e)}",
                'actions': []
            }

    async def handle_clickhouse_config(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process ClickHouse configuration (Step 1 of ClickHouse flow).

        User selected database/table, now show schema preview.
        """
        if data.get('cancelled'):
            session_id = data.get('sessionId')
            if session_id:
                self._clear_session(session_id)
            return {
                'message': "Pipeline setup cancelled. Let me know if you'd like to start over.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        # Store ClickHouse config from frontend (database, table, createNew)
        clickhouse_config = {
            'database': data.get('database'),
            'table': data.get('table'),
            'createNew': data.get('createNew', True)
        }
        session['clickhouse_config'] = clickhouse_config
        session['steps_completed'].append('clickhouse_config')

        # Get source tables and schema information
        credential_id = data.get('credentialId') or session.get('credential_id')
        selected_tables = data.get('selectedTables') or session.get('selected_tables', [])

        try:
            # Get source table schemas for preview
            from app.services.schema_discovery_service import schema_discovery_service

            source_schema = []
            for table_name in selected_tables:
                schema_result = schema_discovery_service.discover(
                    user_id=user_id,
                    credential_id=credential_id,
                    schema_filter='public',
                    include_row_counts=False
                )

                # Find the specific table and extract columns
                for table in schema_result.get('tables', []):
                    full_name = f"{table.get('schema_name')}.{table.get('table_name')}"
                    if full_name == table_name:
                        for col in table.get('columns', []):
                            source_schema.append({
                                'name': col.get('column_name'),
                                'type': col.get('data_type'),
                                'nullable': col.get('is_nullable', True),
                                'isPk': col.get('is_pk', False)
                            })
                        break

            # Store source schema in session
            session['source_schema'] = source_schema
            session['credential_id'] = credential_id
            session['selected_tables'] = selected_tables

            # Return schema preview - user will describe intent, then we generate
            return {
                'message': "Great! Now describe your analytics goals so I can generate an optimized ClickHouse schema:",
                'actions': [{
                    'type': 'confirm_schema_preview',
                    'label': 'Configure Schema',
                    'schemaContext': {
                        'credentialId': credential_id,
                        'selectedTables': selected_tables,
                        'sourceSchema': source_schema,
                        'clickhouseConfig': clickhouse_config,
                        'promptForIntent': True,  # Show intent textarea first
                        'generatedSchema': None,  # Will be populated after user describes intent
                        'sessionId': session_id
                    }
                }]
            }

        except Exception as e:
            return {
                'message': f"Failed to get source schema: {str(e)}",
                'actions': []
            }

    async def handle_schema_preview(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process schema preview confirmation.

        After schema approval, show topic and schema registry confirmation.
        """
        if data.get('cancelled'):
            session_id = data.get('sessionId')
            if session_id:
                self._clear_session(session_id)
            return {
                'message': "Pipeline setup cancelled. Let me know if you'd like to start over.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        # Get approved schema from frontend (the generatedSchema that was approved)
        approved_schema = data.get('approvedSchema', data.get('generatedSchema'))
        session['approved_schema'] = approved_schema
        session['steps_completed'].append('schema_approved')

        # Get source tables and config
        credential_id = session.get('credential_id')
        selected_tables = session.get('selected_tables', [])
        clickhouse_config = session.get('clickhouse_config', {})

        # Build topic name (Debezium format: server_name.schema.table)
        # Use placeholder that will be replaced during pipeline creation
        table_name = selected_tables[0] if selected_tables else 'events'
        parts = table_name.split('.')
        schema = parts[0] if len(parts) > 1 else 'public'
        table = parts[1] if len(parts) > 1 else parts[0]
        topic_name = f"dataflow_pipeline.{schema}.{table}"

        # Build Avro schema from approved ClickHouse schema
        avro_fields = []
        if approved_schema and approved_schema.get('columns'):
            for col in approved_schema['columns']:
                # Map ClickHouse types to Avro types
                ch_type = col.get('type', 'String')
                avro_type = self._clickhouse_to_avro_type(ch_type)

                # Handle nullable types
                if col.get('nullable', True):
                    avro_fields.append({
                        'name': col.get('name'),
                        'type': ['null', avro_type]
                    })
                else:
                    avro_fields.append({
                        'name': col.get('name'),
                        'type': avro_type
                    })

        avro_schema = {
            'type': 'record',
            'name': table,
            'namespace': f"com.dataflow.{schema}",
            'fields': avro_fields
        }

        schema_registry_subject = f"{topic_name}-value"

        session['topic_name'] = topic_name
        session['avro_schema'] = avro_schema
        session['schema_registry_subject'] = schema_registry_subject

        # Calculate cost estimation
        try:
            # Get table info for cost estimation
            tables_info = []
            for table_name in selected_tables:
                tables_info.append({
                    'table_name': table_name,
                    'estimated_row_count': session.get('filtered_row_count', 10000),  # Use filtered count if available
                    'columns': approved_schema.get('columns', []) if approved_schema else []
                })

            # Calculate filter reduction if filter was applied
            filter_reduction = 0
            has_filter = session.get('filter_applied', False)
            if has_filter:
                original_count = session.get('original_row_count', 0)
                filtered_count = session.get('filtered_row_count', 0)
                if original_count > 0:
                    filter_reduction = ((original_count - filtered_count) / original_count) * 100

            # Get cost estimate
            cost_estimate = cost_estimator.estimate_from_tables(
                tables=tables_info,
                sink_type='clickhouse',
                has_filter=has_filter,
                filter_reduction_percent=filter_reduction
            )

            # Convert to frontend-compatible format
            cost_components = []
            for component in cost_estimate.components:
                cost_components.append({
                    'name': component.name,
                    'description': component.description,
                    'unitCost': component.unit_cost,
                    'unit': component.unit,
                    'quantity': component.quantity,
                    'dailyCost': component.daily_cost,
                    'monthlyCost': component.monthly_cost
                })

            # Store cost in session
            session['cost_estimate'] = cost_estimate.to_dict()

            # Return cost estimation confirmation
            pipeline_name = f"{selected_tables[0].split('.')[-1].title()} to ClickHouse"

            return {
                'message': f"Great! Here's the estimated cost for your pipeline before we create it:",
                'actions': [{
                    'type': 'confirm_cost',
                    'label': 'Review Costs',
                    'costContext': {
                        'pipelineName': pipeline_name,
                        'components': cost_components,
                        'totals': {
                            'daily': round(cost_estimate.daily_total, 2),
                            'monthly': round(cost_estimate.monthly_total, 2),
                            'yearly': round(cost_estimate.yearly_total, 2)
                        },
                        'notes': cost_estimate.notes,
                        'assumptions': {
                            'tables': len(selected_tables),
                            'estimatedEventsPerDay': cost_estimate.assumptions.get('estimated_events_per_day', 0),
                            'effectiveEventsPerDay': cost_estimate.assumptions.get('effective_events_per_day', 0),
                            'avgRowSizeBytes': cost_estimate.assumptions.get('avg_row_size_bytes', 500),
                            'filterApplied': has_filter,
                            'filterReductionPercent': filter_reduction if has_filter else 0,
                            'aggregationApplied': False
                        },
                        'sessionId': session_id
                    }
                }]
            }

        except Exception as e:
            print(f"[COST_ESTIMATION] Error calculating cost: {e}")
            # Fall through to topic registry if cost estimation fails
            pass

        # Fallback: Return topic registry confirmation with correct structure
        return {
            'message': f"Perfect! Your schema looks good. Here's how the data will flow from Kafka to ClickHouse:",
            'actions': [{
                'type': 'confirm_topic_registry',
                'label': 'Review Data Flow',
                'topicContext': {
                    'credentialId': credential_id,
                    'selectedTables': selected_tables,
                    'clickhouseConfig': clickhouse_config,
                    'approvedSchema': approved_schema,
                    'topicName': topic_name,
                    'avroSchema': avro_schema,
                    'schemaRegistrySubject': schema_registry_subject,
                    'sessionId': session_id
                }
            }]
        }

    def _clickhouse_to_avro_type(self, ch_type: str) -> str:
        """Map ClickHouse types to Avro types"""
        ch_type_lower = ch_type.lower()

        if 'int' in ch_type_lower:
            if '64' in ch_type_lower:
                return 'long'
            return 'int'
        elif 'float' in ch_type_lower or 'double' in ch_type_lower or 'decimal' in ch_type_lower:
            return 'double'
        elif 'bool' in ch_type_lower:
            return 'boolean'
        elif 'date' in ch_type_lower or 'time' in ch_type_lower:
            return 'string'  # Avro uses string for timestamps typically
        else:
            return 'string'

    async def handle_topic_registry_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process topic registry confirmation.

        Creates the complete pipeline with source connector, ClickHouse tables, and sink connector.
        """
        if data.get('cancelled'):
            session_id = data.get('sessionId')
            if session_id:
                self._clear_session(session_id)
            return {
                'message': "Pipeline setup cancelled. Let me know if you'd like to start over.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        # Get credential_id from session or data (context persistence)
        credential_id = session.get('credential_id') or data.get('credentialId') or data.get('credential_id')

        print(f"[TOPIC_REGISTRY] Session data: {session}")
        print(f"[TOPIC_REGISTRY] credential_id from session: {credential_id}")

        if not credential_id:
            return {
                'message': "Error: Source credential not found. Please start over and select a data source first.",
                'actions': []
            }

        try:
            # Create pipeline record
            db_session = db_service._get_session()
            try:
                # Generate pipeline name
                selected_tables = session.get('selected_tables', [])
                table_hint = selected_tables[0].split('.')[-1] if selected_tables else 'data'
                pipeline_name = data.get('pipelineName', f"{table_hint.title()} to ClickHouse")

                # Create pipeline with updated config structure
                clickhouse_config = session.get('clickhouse_config', {})
                approved_schema = session.get('approved_schema', {})

                # Build source_filters if filter was applied
                source_filters = None
                filter_sql = session.get('filter_sql')
                filter_requirement = session.get('filter_requirement')
                if filter_sql:
                    source_filters = {
                        'filter_sql': filter_sql,
                        'filter_requirement': filter_requirement,
                        'applied': True
                    }
                    print(f"[PIPELINE_CREATE] Filter will be applied: {filter_sql}")

                pipeline = Pipeline(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    name=pipeline_name,
                    source_credential_id=credential_id,  # Use the credential_id we validated above
                    source_tables=selected_tables if selected_tables else ['public.events'],
                    sink_type='clickhouse',
                    sink_config={
                        'clickhouse': clickhouse_config,
                        'schema': approved_schema,
                        'topic_name': session.get('topic_name'),
                        'avro_schema': session.get('avro_schema'),
                        'schema_registry_subject': session.get('schema_registry_subject')
                    },
                    source_filters=source_filters,  # Include filter config for ksqlDB
                    status='pending'
                )
                db_session.add(pipeline)
                db_session.commit()
                db_session.refresh(pipeline)

                print(f"[PIPELINE_CREATE] ClickHouse pipeline created: id={pipeline.id}")

                # Store pipeline info in session
                session['pipeline_id'] = pipeline.id
                session['pipeline_name'] = pipeline.name
                session['steps_completed'].append('pipeline_created')

                # Offer alert setup (same as regular pipeline confirmation)
                return {
                    'message': f"Pipeline '{pipeline.name}' created successfully! Would you like to set up monitoring alerts for this pipeline?",
                    'actions': [{
                        'type': 'confirm_alert_config',
                        'label': 'Configure Alerts',
                        'alertContext': {
                            'pipelineId': pipeline.id,
                            'pipelineName': pipeline.name,
                            'suggestedName': f"{pipeline.name} Monitor",
                            'ruleTypes': [
                                {
                                    'type': 'gap_detection',
                                    'name': 'Gap Detection',
                                    'description': 'Alert when no events are received for a period',
                                    'recommended': True
                                },
                                {
                                    'type': 'volume_spike',
                                    'name': 'Volume Spike',
                                    'description': 'Alert when event volume exceeds baseline',
                                    'recommended': False
                                },
                                {
                                    'type': 'volume_drop',
                                    'name': 'Volume Drop',
                                    'description': 'Alert when event volume drops significantly',
                                    'recommended': False
                                },
                                {
                                    'type': 'null_ratio',
                                    'name': 'NULL Ratio',
                                    'description': 'Alert when NULL values exceed threshold',
                                    'recommended': False
                                }
                            ],
                            'defaultConfig': {
                                'severity': 'warning',
                                'enabledDays': [0, 1, 2, 3, 4],
                                'enabledHours': {'start': 9, 'end': 17},
                                'cooldownMinutes': 30
                            },
                            'sessionId': session_id
                        }
                    }, {
                        'type': 'confirm_action',
                        'label': 'Skip Alerts',
                        'actionContext': {
                            'actionId': 'skip_alerts',
                            'title': 'Skip Alert Setup',
                            'description': 'You can always configure alerts later from the pipeline details page.',
                            'confirmLabel': 'Skip',
                            'cancelLabel': 'Go Back',
                            'variant': 'default',
                            'metadata': {'pipelineId': pipeline.id}
                        }
                    }]
                }

            except Exception as e:
                db_session.rollback()
                raise e
            finally:
                db_session.close()

        except Exception as e:
            return {
                'message': f"Failed to create pipeline: {str(e)}",
                'actions': []
            }

    async def handle_generic_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process generic yes/no confirmation.
        """
        action_id = data.get('actionId')
        confirmed = data.get('confirmed', False)
        metadata = data.get('metadata', {})

        if action_id == 'skip_alerts':
            pipeline_id = metadata.get('pipelineId')
            return {
                'message': "No problem! Your pipeline is ready to go. You can configure alerts anytime from the pipeline details page.",
                'actions': [{
                    'type': 'link',
                    'url': f'/dashboard/pipelines/{pipeline_id}',
                    'label': 'View Pipeline'
                }]
            }

        return {
            'message': "Action completed.",
            'actions': []
        }


# Singleton instance
confirmation_handlers = ConfirmationHandlers()
