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
        """
        if data.get('cancelled'):
            return {
                'message': "No problem! Let me know when you're ready to set up a CDC pipeline.",
                'actions': []
            }

        session_id = data.get('sessionId', str(uuid.uuid4()))
        session = self._get_session(session_id)

        # Check if user wants to create new source
        if data.get('createNew'):
            return {
                'message': "I've opened the Data Sources page in a new tab. Once you've added your new data source there, come back here and say 'set up pipeline' to continue!",
                'actions': []
            }

        # User selected an existing credential
        credential_id = data.get('credentialId')
        credential_name = data.get('credentialName')
        host = data.get('host')
        database = data.get('database')

        if not credential_id:
            return {
                'message': "Please select a data source to continue.",
                'actions': []
            }

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

        After tables are selected, returns destination selection action.
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

    async def handle_destination_confirmation(
        self,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process destination selection.

        After destination is selected, returns pipeline confirmation action.
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

        # Generate suggested pipeline name
        table_hint = selected_tables[0].split('.')[-1] if selected_tables else 'data'
        suggested_name = f"{table_hint.title()} CDC Pipeline"

        # Return pipeline confirmation action
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
