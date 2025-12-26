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
def create_kafka_pipeline(connector_id: str, customer_id: str = "", force_reprocess: bool = False) -> str:
    """Create a real-time Kafka streaming pipeline for a connected data source.

    Use this tool after a user has successfully connected a data source.
    This starts continuous data streaming from the source through Kafka to Flink.

    Args:
        connector_id: The ID of the connected source (e.g., 'google_ads').
        customer_id: Optional Google Ads customer ID (e.g., '123-456-7890').
        force_reprocess: If True, skip duplicate check and force reprocessing.

    Returns:
        JSON string with pipeline status, Kafka topic name, and next steps.
        May return a confirm_reprocess action if data was already processed.
    """
    from app.services.firebase_service import firebase_service
    from app.services.kafka_producer import kafka_producer
    from app.services.google_ads_service import google_ads_service
    from app.services.processing_tracker import processing_tracker

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

    # Check for duplicate processing (unless force_reprocess is True)
    if not force_reprocess:
        is_processed, processed_at, metadata = processing_tracker.is_already_processed(
            user_id=user_id,
            connector_id=provider_key,
            customer_id=customer_id or "default"
        )

        if is_processed and processed_at:
            time_ago = processing_tracker.get_time_since_processed(processed_at)
            campaigns_count = metadata.get("campaigns_count", 0) if metadata else 0

            return json.dumps({
                "status": "already_processed",
                "message": f"This data was already processed {time_ago} ({campaigns_count} campaigns). Do you want to reprocess it? This may create duplicates in your pipeline.",
                "processed_at": processed_at.isoformat(),
                "campaigns_count": campaigns_count,
                "action_required": True,
                "action_type": "confirm_reprocess",
                "confirmation_data": {
                    "connector_id": connector_id,
                    "customer_id": customer_id,
                    "user_id": user_id
                }
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

            # Mark as processed
            processing_tracker.mark_as_processed(
                user_id=user_id,
                connector_id=provider_key,
                customer_id=customer_id or "default",
                campaigns_count=len(campaigns),
                reprocessed=force_reprocess
            )

            result = {
                "status": "streaming",
                "mode": "mock",
                "topic": topic,
                "campaigns_streamed": len(campaigns),
                "pipeline": f"Google Ads → Kafka ({topic}) → Flink → processed_metrics",
                "message": f"{'Reprocessed' if force_reprocess else 'Pipeline created'}! Streamed {len(campaigns)} demo campaigns to Kafka.",
                "next_step": "Use generate_dashboard to create your analytics dashboard.",
                "reprocessed": force_reprocess
            }
        else:
            # Production mode: use real API
            stream_result = google_ads_service.fetch_and_stream(
                customer_id=customer_id or "demo",
                tokens=tokens,
                user_id=user_id
            )

            if stream_result["success"]:
                # Mark as processed
                processing_tracker.mark_as_processed(
                    user_id=user_id,
                    connector_id=provider_key,
                    customer_id=customer_id or "default",
                    campaigns_count=stream_result.get("count", 0),
                    reprocessed=force_reprocess
                )

            result = {
                "status": "streaming" if stream_result["success"] else "error",
                "mode": "production",
                "topic": topic,
                "campaigns_streamed": stream_result.get("count", 0),
                "pipeline": f"Google Ads API → Kafka ({topic}) → Flink → processed_metrics",
                "message": stream_result["message"],
                "next_step": "Use generate_dashboard to create your analytics dashboard.",
                "reprocessed": force_reprocess
            }
    else:
        result = {
            "status": "error",
            "message": f"Pipeline for '{connector_id}' is not supported yet."
        }

    return json.dumps(result, indent=2)


@tool
def store_credentials(
    name: str,
    source_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    test_connection: bool = True
) -> str:
    """Store encrypted database credentials for CDC pipeline setup.

    Use this tool when the user wants to connect a database for CDC streaming.
    This securely stores credentials using AES-256-GCM encryption.

    IMPORTANT: This tool first checks for existing credentials with the same
    host/database/port. If found, it returns the existing credential instead
    of creating a duplicate.

    Args:
        name: Friendly name for this connection (e.g., "Production DB")
        source_type: Database type - currently only 'postgresql' supported
        host: Database hostname or IP
        port: Database port (default 5432 for PostgreSQL)
        database: Database name
        username: Database username with replication privileges
        password: Database password
        test_connection: Whether to test before saving (default True)

    Returns:
        JSON with credential ID and validation status
    """
    from app.services.credential_service import credential_service

    user_id = get_user_context()

    try:
        # Check for existing credential with same host/database/port
        existing = credential_service.find_existing_credential(
            user_id=user_id,
            host=host,
            database=database,
            port=port
        )

        if existing:
            # Return existing credential instead of creating duplicate
            return json.dumps({
                "status": "success",
                "message": f"Found existing connection for {host}:{port}/{database}",
                "credential_id": existing['id'],
                "credential_name": existing['name'],
                "is_valid": existing['is_valid'],
                "host": existing['host'],
                "database": existing['database'],
                "already_exists": True,
                "next_step": "Use discover_schema with this credential_id to explore tables"
            }, indent=2)

        credentials_dict = {
            'host': host,
            'port': port,
            'database': database,
            'username': username,
            'password': password
        }

        result = credential_service.store_credentials(
            user_id=user_id,
            name=name,
            source_type=source_type,
            credentials=credentials_dict,
            test_connection=test_connection
        )

        response = {
            "status": "success",
            "message": f"Credentials '{name}' stored successfully",
            "credential_id": result['id'],
            "is_valid": result['is_valid'],
            "host": result['host'],
            "database": result['database'],
            "next_step": "Use discover_schema to explore available tables"
        }

        return json.dumps(response, indent=2)

    except ValueError as e:
        return json.dumps({
            "status": "error",
            "message": str(e),
            "error_type": "connection_failed"
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to store credentials: {str(e)}"
        }, indent=2)


@tool
def discover_schema(
    credential_id: str = "",
    credential_name: str = "",
    schema_filter: str = "public",
    include_row_counts: bool = False
) -> str:
    """Discover database schema from a connected PostgreSQL source.

    Use this to explore tables, columns, relationships, and identify CDC-eligible tables.

    Args:
        credential_id: ID of stored credentials
        credential_name: Friendly name of credentials (alternative to ID)
        schema_filter: Database schema to discover (default 'public')
        include_row_counts: Whether to estimate row counts

    Returns:
        JSON with tables, columns, relationships, CDC eligibility
    """
    from app.services.schema_discovery_service import schema_discovery_service
    from app.services.credential_service import credential_service

    user_id = get_user_context()

    try:
        # Resolve credential_id from name if needed
        if credential_name and not credential_id:
            credentials = credential_service.list_credentials(user_id)
            matching = [c for c in credentials if c['name'] == credential_name]
            if not matching:
                return json.dumps({
                    "status": "error",
                    "message": f"No credential found with name '{credential_name}'"
                }, indent=2)
            credential_id = matching[0]['id']

        if not credential_id:
            return json.dumps({
                "status": "error",
                "message": "Either credential_id or credential_name is required"
            }, indent=2)

        # Discover schema
        result = schema_discovery_service.discover(
            user_id=user_id,
            credential_id=credential_id,
            schema_filter=schema_filter,
            include_row_counts=include_row_counts
        )

        # Format response for better readability
        cdc_eligible_tables = [t for t in result['tables'] if t['cdc_eligible']]
        tables_with_issues = [t for t in result['tables'] if not t['cdc_eligible']]

        response = {
            "status": "success",
            "schema": schema_filter,
            "total_tables": result['table_count'],
            "cdc_eligible_tables": len(cdc_eligible_tables),
            "tables": result['tables'],
            "relationship_graph": result['relationship_graph'],
            "summary": {
                "ready_for_cdc": [f"{t['schema_name']}.{t['table_name']}" for t in cdc_eligible_tables],
                "needs_attention": [
                    {
                        "table": f"{t['schema_name']}.{t['table_name']}",
                        "issues": t['cdc_issues']
                    } for t in tables_with_issues
                ]
            },
            "next_step": "Use check_cdc_readiness to validate database configuration"
        }

        return json.dumps(response, indent=2)

    except ValueError as e:
        return json.dumps({
            "status": "error",
            "message": str(e)
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Schema discovery failed: {str(e)}"
        }, indent=2)


@tool
def check_cdc_readiness(
    credential_id: str = "",
    credential_name: str = "",
    tables: str = ""
) -> str:
    """Check if a PostgreSQL database is ready for Change Data Capture.

    Validates wal_level, replication privileges, and provides fix instructions.

    Args:
        credential_id: ID of stored credentials
        credential_name: Friendly name of credentials
        tables: Comma-separated table names to check (e.g., "public.users,public.orders")

    Returns:
        JSON with readiness status, issues, and provider-specific fix instructions
    """
    from app.services.cdc_readiness_service import cdc_readiness_service
    from app.services.credential_service import credential_service

    user_id = get_user_context()

    try:
        # Resolve credential_id from name if needed
        if credential_name and not credential_id:
            credentials = credential_service.list_credentials(user_id)
            matching = [c for c in credentials if c['name'] == credential_name]
            if not matching:
                return json.dumps({
                    "status": "error",
                    "message": f"No credential found with name '{credential_name}'"
                }, indent=2)
            credential_id = matching[0]['id']

        if not credential_id:
            return json.dumps({
                "status": "error",
                "message": "Either credential_id or credential_name is required"
            }, indent=2)

        # Parse tables list
        table_list = None
        if tables:
            table_list = [t.strip() for t in tables.split(',') if t.strip()]

        # Check readiness
        result = cdc_readiness_service.check_readiness(
            user_id=user_id,
            credential_id=credential_id,
            tables=table_list
        )

        # Format response
        response = {
            "status": "ready" if result['overall_ready'] else "not_ready",
            "provider": result['provider_name'],
            "server_version": result['server_version'],
            "overall_ready": result['overall_ready'],
            "checks": result['checks'],
            "table_checks": result['table_checks'],
            "recommendations": result['recommendations']
        }

        if result['overall_ready']:
            response['message'] = "Database is ready for CDC! All prerequisites are met."
            response['next_step'] = "You can now set up CDC pipelines for your tables"
        else:
            critical_issues = [r for r in result['recommendations'] if r['priority'] == 'critical']
            response['message'] = f"Database is NOT ready for CDC. Found {len(critical_issues)} critical issue(s)."
            response['next_step'] = "Follow the recommendations to fix issues, then check readiness again"

        return json.dumps(response, indent=2)

    except ValueError as e:
        return json.dumps({
            "status": "error",
            "message": str(e)
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"CDC readiness check failed: {str(e)}"
        }, indent=2)


@tool
def preview_sample_data(
    credential_id: str = "",
    credential_name: str = "",
    table_name: str = "",
    schema_name: str = "public",
    limit: int = 100
) -> str:
    """Preview sample data from a database table before setting up CDC.

    Use this to explore table contents and validate data quality.

    Args:
        credential_id: ID of stored credentials
        credential_name: Friendly name of credentials (alternative to ID)
        table_name: Table name to preview
        schema_name: Schema name (default 'public')
        limit: Number of rows to fetch (default 100, max 1000)

    Returns:
        JSON with sample rows, column metadata, and row counts
    """
    from app.services.sample_data_service import sample_data_service
    from app.services.credential_service import credential_service

    user_id = get_user_context()

    try:
        # Resolve credential_id from name if needed
        if credential_name and not credential_id:
            credentials = credential_service.list_credentials(user_id)
            matching = [c for c in credentials if c['name'] == credential_name]
            if not matching:
                return json.dumps({
                    "status": "error",
                    "message": f"No credential found with name '{credential_name}'"
                }, indent=2)
            credential_id = matching[0]['id']

        if not credential_id:
            return json.dumps({
                "status": "error",
                "message": "Either credential_id or credential_name is required"
            }, indent=2)

        if not table_name:
            return json.dumps({
                "status": "error",
                "message": "table_name is required"
            }, indent=2)

        # Fetch sample data
        result = sample_data_service.fetch_sample(
            user_id=user_id,
            credential_id=credential_id,
            table_name=table_name,
            schema_name=schema_name,
            limit=min(limit, 1000)  # Cap at 1000
        )

        # Format response for readability
        response = {
            "status": "success",
            "table": f"{result['schema_name']}.{result['table_name']}",
            "columns": result['columns'],
            "sample_rows": result['rows'][:10],  # Show only first 10 rows in tool output
            "total_rows_fetched": result['row_count'],
            "total_rows_in_table": result['total_rows_estimate'],
            "fetched_at": result['fetched_at'],
            "message": f"Fetched {result['row_count']} sample rows from {result['schema_name']}.{result['table_name']} (estimated total: {result['total_rows_estimate']} rows)",
            "next_step": "Use this data to design transformations or check data quality"
        }

        return json.dumps(response, indent=2)

    except ValueError as e:
        return json.dumps({
            "status": "error",
            "message": str(e)
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to preview sample data: {str(e)}"
        }, indent=2)


@tool
def create_cdc_pipeline(
    source_credential_id: str = "",
    source_credential_name: str = "",
    tables: str = "",
    sink_type: str = "clickhouse",
    pipeline_name: str = ""
) -> str:
    """Create a CDC pipeline to sync data from PostgreSQL to a sink (ClickHouse, Kafka).

    Use this tool to set up real-time data sync from a source database to a destination.
    This creates Debezium connectors on Confluent Cloud to capture changes.

    Args:
        source_credential_id: ID of stored source database credentials
        source_credential_name: Friendly name of credentials (alternative to ID)
        tables: Comma-separated list of tables to sync (e.g., "public.users,public.orders")
        sink_type: Destination type - 'clickhouse' or 'kafka' (default: clickhouse)
        pipeline_name: Name for the pipeline (auto-generated if not provided)

    Returns:
        JSON with pipeline ID, status, and connector details
    """
    from app.services.credential_service import credential_service
    from app.db.models import Pipeline
    from app.services.db_service import db_service
    import uuid

    user_id = get_user_context()

    try:
        # Resolve credential_id from name if needed
        if source_credential_name and not source_credential_id:
            credentials = credential_service.list_credentials(user_id)
            matching = [c for c in credentials if c['name'] == source_credential_name]
            if not matching:
                return json.dumps({
                    "status": "error",
                    "message": f"No credential found with name '{source_credential_name}'"
                }, indent=2)
            source_credential_id = matching[0]['id']

        if not source_credential_id:
            return json.dumps({
                "status": "error",
                "message": "Either source_credential_id or source_credential_name is required"
            }, indent=2)

        if not tables:
            return json.dumps({
                "status": "error",
                "message": "tables parameter is required (e.g., 'public.users,public.orders')"
            }, indent=2)

        # Parse tables list
        table_list = [t.strip() for t in tables.split(',') if t.strip()]

        # Generate pipeline name if not provided
        if not pipeline_name:
            pipeline_name = f"CDC Pipeline - {datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Create pipeline record
        session = db_service._get_session()
        try:
            pipeline = Pipeline(
                id=str(uuid.uuid4()),
                user_id=user_id,
                name=pipeline_name,
                source_credential_id=source_credential_id,
                source_tables=table_list,
                sink_type=sink_type,
                sink_config={},
                status="pending"
            )
            session.add(pipeline)
            session.commit()
            session.refresh(pipeline)

            response = {
                "status": "success",
                "message": f"Pipeline '{pipeline_name}' created successfully",
                "pipeline_id": pipeline.id,
                "tables": table_list,
                "sink_type": sink_type,
                "pipeline_status": "pending",
                "next_step": "Use start_cdc_pipeline to deploy and start the pipeline"
            }

            return json.dumps(response, indent=2)

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to create pipeline: {str(e)}"
        }, indent=2)


@tool
def start_cdc_pipeline(
    pipeline_id: str = "",
    pipeline_name: str = ""
) -> str:
    """Start a CDC pipeline to begin streaming changes.

    Use this to deploy connectors and start real-time data sync.

    Args:
        pipeline_id: ID of the pipeline to start
        pipeline_name: Name of the pipeline (alternative to ID)

    Returns:
        JSON with pipeline status and connector information
    """
    from app.db.models import Pipeline
    from app.services.db_service import db_service
    from app.services.confluent_connector_service import confluent_connector_service
    from app.services.pipeline_monitor import pipeline_monitor

    user_id = get_user_context()

    try:
        session = db_service._get_session()
        try:
            # Find pipeline
            if pipeline_name and not pipeline_id:
                pipeline = session.query(Pipeline).filter(
                    Pipeline.user_id == user_id,
                    Pipeline.name == pipeline_name
                ).first()
            else:
                pipeline = session.query(Pipeline).filter(
                    Pipeline.id == pipeline_id,
                    Pipeline.user_id == user_id
                ).first()

            if not pipeline:
                return json.dumps({
                    "status": "error",
                    "message": "Pipeline not found"
                }, indent=2)

            if pipeline.status == "running":
                return json.dumps({
                    "status": "error",
                    "message": "Pipeline is already running"
                }, indent=2)

            # Create source connector
            connector_result = confluent_connector_service.create_source_connector(
                user_id=user_id,
                credential_id=pipeline.source_credential_id,
                pipeline_id=pipeline.id,
                tables=pipeline.source_tables,
                snapshot_mode="initial"
            )

            # Update pipeline status
            pipeline.source_connector_name = connector_result['connector_name']
            pipeline.status = "running"
            pipeline.started_at = datetime.utcnow()
            pipeline.error_message = None
            session.commit()

            pipeline_monitor.log_event(pipeline.id, "started", f"Pipeline '{pipeline.name}' started")

            response = {
                "status": "success",
                "message": f"Pipeline '{pipeline.name}' started successfully",
                "pipeline_id": pipeline.id,
                "pipeline_status": "running",
                "source_connector": connector_result['connector_name'],
                "tables": pipeline.source_tables,
                "started_at": pipeline.started_at.isoformat()
            }

            return json.dumps(response, indent=2)

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to start pipeline: {str(e)}"
        }, indent=2)


@tool
def get_pipeline_status(
    pipeline_id: str = "",
    pipeline_name: str = ""
) -> str:
    """Get the current status and health of a CDC pipeline.

    Use this to check if a pipeline is running, view metrics, or diagnose issues.

    Args:
        pipeline_id: ID of the pipeline
        pipeline_name: Name of the pipeline (alternative to ID)

    Returns:
        JSON with pipeline status, health, and metrics
    """
    from app.db.models import Pipeline
    from app.services.db_service import db_service
    from app.services.pipeline_monitor import pipeline_monitor

    user_id = get_user_context()

    try:
        session = db_service._get_session()
        try:
            # Find pipeline
            if pipeline_name and not pipeline_id:
                pipeline = session.query(Pipeline).filter(
                    Pipeline.user_id == user_id,
                    Pipeline.name == pipeline_name
                ).first()
            else:
                pipeline = session.query(Pipeline).filter(
                    Pipeline.id == pipeline_id,
                    Pipeline.user_id == user_id
                ).first()

            if not pipeline:
                return json.dumps({
                    "status": "error",
                    "message": "Pipeline not found"
                }, indent=2)

            # Get health if running
            health = None
            if pipeline.status in ["running", "paused"]:
                try:
                    health = pipeline_monitor.get_pipeline_health(pipeline.id)
                except Exception as e:
                    health = {"error": str(e)}

            response = {
                "status": "success",
                "pipeline_id": pipeline.id,
                "pipeline_name": pipeline.name,
                "pipeline_status": pipeline.status,
                "tables": pipeline.source_tables,
                "sink_type": pipeline.sink_type,
                "source_connector": pipeline.source_connector_name,
                "created_at": pipeline.created_at.isoformat() if pipeline.created_at else None,
                "started_at": pipeline.started_at.isoformat() if pipeline.started_at else None,
                "health": health,
                "error_message": pipeline.error_message
            }

            return json.dumps(response, indent=2)

        finally:
            session.close()

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to get pipeline status: {str(e)}"
        }, indent=2)


@tool
def control_cdc_pipeline(
    pipeline_id: str = "",
    pipeline_name: str = "",
    action: str = ""
) -> str:
    """Control a CDC pipeline (stop, pause, resume).

    Use this to manage pipeline lifecycle.

    Args:
        pipeline_id: ID of the pipeline
        pipeline_name: Name of the pipeline (alternative to ID)
        action: Action to perform - 'stop', 'pause', or 'resume'

    Returns:
        JSON with updated pipeline status
    """
    from app.db.models import Pipeline
    from app.services.db_service import db_service
    from app.services.confluent_connector_service import confluent_connector_service
    from app.services.pipeline_monitor import pipeline_monitor

    user_id = get_user_context()

    if action not in ['stop', 'pause', 'resume']:
        return json.dumps({
            "status": "error",
            "message": f"Invalid action '{action}'. Valid actions: stop, pause, resume"
        }, indent=2)

    try:
        session = db_service._get_session()
        try:
            # Find pipeline
            if pipeline_name and not pipeline_id:
                pipeline = session.query(Pipeline).filter(
                    Pipeline.user_id == user_id,
                    Pipeline.name == pipeline_name
                ).first()
            else:
                pipeline = session.query(Pipeline).filter(
                    Pipeline.id == pipeline_id,
                    Pipeline.user_id == user_id
                ).first()

            if not pipeline:
                return json.dumps({
                    "status": "error",
                    "message": "Pipeline not found"
                }, indent=2)

            # Perform action
            if action == 'stop':
                if pipeline.source_connector_name:
                    confluent_connector_service.delete_connector(pipeline.source_connector_name)
                pipeline.status = "stopped"
                pipeline.stopped_at = datetime.utcnow()
                pipeline.source_connector_name = None
                pipeline_monitor.log_event(pipeline.id, "stopped", f"Pipeline '{pipeline.name}' stopped")

            elif action == 'pause':
                if pipeline.status != "running":
                    return json.dumps({
                        "status": "error",
                        "message": "Can only pause a running pipeline"
                    }, indent=2)
                if pipeline.source_connector_name:
                    confluent_connector_service.pause_connector(pipeline.source_connector_name)
                pipeline.status = "paused"
                pipeline_monitor.log_event(pipeline.id, "paused", f"Pipeline '{pipeline.name}' paused")

            elif action == 'resume':
                if pipeline.status != "paused":
                    return json.dumps({
                        "status": "error",
                        "message": "Can only resume a paused pipeline"
                    }, indent=2)
                if pipeline.source_connector_name:
                    confluent_connector_service.resume_connector(pipeline.source_connector_name)
                pipeline.status = "running"
                pipeline_monitor.log_event(pipeline.id, "resumed", f"Pipeline '{pipeline.name}' resumed")

            session.commit()

            response = {
                "status": "success",
                "message": f"Pipeline '{pipeline.name}' {action}ed successfully",
                "pipeline_id": pipeline.id,
                "pipeline_status": pipeline.status
            }

            return json.dumps(response, indent=2)

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to {action} pipeline: {str(e)}"
        }, indent=2)


@tool
def list_cdc_pipelines() -> str:
    """List all CDC pipelines for the current user.

    Returns:
        JSON with list of pipelines and their status
    """
    from app.db.models import Pipeline
    from app.services.db_service import db_service

    user_id = get_user_context()

    try:
        session = db_service._get_session()
        try:
            pipelines = session.query(Pipeline).filter(
                Pipeline.user_id == user_id
            ).order_by(Pipeline.created_at.desc()).all()

            pipeline_list = []
            for p in pipelines:
                pipeline_list.append({
                    "id": p.id,
                    "name": p.name,
                    "status": p.status,
                    "tables": p.source_tables,
                    "sink_type": p.sink_type,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                    "started_at": p.started_at.isoformat() if p.started_at else None
                })

            response = {
                "status": "success",
                "pipelines": pipeline_list,
                "total_count": len(pipeline_list)
            }

            return json.dumps(response, indent=2)

        finally:
            session.close()

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to list pipelines: {str(e)}"
        }, indent=2)


@tool
def create_enrichment(
    pipeline_id: str,
    name: str,
    source_topic: str,
    lookup_tables: str,
    join_keys: str,
    output_columns: str,
    join_type: str = "LEFT",
    description: str = ""
) -> str:
    """
    Create a data enrichment pipeline using stream-table JOINs.

    Use this when the user wants to:
    - Enrich event data with lookup table data
    - Add user info to login events
    - Add product details to order events
    - Combine CDC streams with reference tables

    Args:
        pipeline_id: ID of the parent CDC pipeline
        name: Name for this enrichment (e.g., "User Login Enrichment")
        source_topic: Kafka topic with the stream events
        lookup_tables: JSON string of lookup tables, e.g.:
            '[{"topic": "users", "key": "user_id", "alias": "u"}]'
        join_keys: JSON string of how to join stream to tables:
            '[{"stream_column": "user_id", "table_column": "id", "table_alias": "u"}]'
        output_columns: Comma-separated list of columns to include in output:
            "s.event_time,s.ip_address,u.email,u.name"
        join_type: "LEFT" or "INNER" (default: "LEFT")
        description: Optional description

    Returns:
        Created enrichment configuration details
    """
    from app.db.models import Pipeline
    from app.services.db_service import db_service
    import uuid

    user_id = get_user_context()

    try:
        # Parse JSON strings
        lookup_tables_list = json.loads(lookup_tables) if isinstance(lookup_tables, str) else lookup_tables
        join_keys_list = json.loads(join_keys) if isinstance(join_keys, str) else join_keys
        output_columns_list = [col.strip() for col in output_columns.split(',')] if isinstance(output_columns, str) else output_columns

        session = db_service._get_session()
        try:
            # Verify parent pipeline exists
            pipeline = session.query(Pipeline).filter(
                Pipeline.id == pipeline_id,
                Pipeline.user_id == user_id
            ).first()

            if not pipeline:
                return json.dumps({
                    "status": "error",
                    "message": f"Parent pipeline '{pipeline_id}' not found"
                }, indent=2)

            # Create enrichment configuration
            enrichment_config = {
                "id": str(uuid.uuid4()),
                "name": name,
                "pipeline_id": pipeline_id,
                "source_topic": source_topic,
                "lookup_tables": lookup_tables_list,
                "join_keys": join_keys_list,
                "output_columns": output_columns_list,
                "join_type": join_type,
                "description": description,
                "status": "pending",
                "created_at": datetime.utcnow().isoformat()
            }

            # Store in pipeline's enrichment_config
            if not pipeline.enrichment_config:
                pipeline.enrichment_config = {}
            if "enrichments" not in pipeline.enrichment_config:
                pipeline.enrichment_config["enrichments"] = []

            pipeline.enrichment_config["enrichments"].append(enrichment_config)
            session.commit()

            response = {
                "status": "success",
                "message": f"Enrichment '{name}' created successfully",
                "enrichment_id": enrichment_config["id"],
                "name": name,
                "source_topic": source_topic,
                "lookup_tables": lookup_tables_list,
                "join_type": join_type,
                "output_columns": output_columns_list,
                "next_step": "Use preview_enrichment to test the JOIN before activating"
            }

            return json.dumps(response, indent=2)

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    except json.JSONDecodeError as e:
        return json.dumps({
            "status": "error",
            "message": f"Invalid JSON format: {str(e)}"
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to create enrichment: {str(e)}"
        }, indent=2)


@tool
def preview_enrichment(
    source_topic: str,
    lookup_topic: str,
    join_key: str,
    output_columns: str,
    limit: int = 10
) -> str:
    """
    Preview what enriched data would look like before creating.

    Use this to show the user sample enriched data.

    Args:
        source_topic: Kafka topic with stream events
        lookup_topic: Kafka topic with lookup table
        join_key: Column to join on
        output_columns: Comma-separated columns to include
        limit: Number of sample rows (default: 10)

    Returns:
        Sample enriched data, NULL statistics, and warnings
    """
    from app.services.transform_simulator import transform_simulator

    user_id = get_user_context()

    try:
        output_columns_list = [col.strip() for col in output_columns.split(',')] if isinstance(output_columns, str) else output_columns

        # Use transform simulator to preview JOIN
        result = transform_simulator.preview_join(
            source_topic=source_topic,
            lookup_topic=lookup_topic,
            join_key=join_key,
            output_columns=output_columns_list,
            limit=limit
        )

        if not result.get("success"):
            return json.dumps({
                "status": "error",
                "message": result.get("error", "Preview failed")
            }, indent=2)

        response = {
            "status": "success",
            "message": f"Preview generated with {len(result.get('sample_data', []))} sample rows",
            "sample_data": result.get("sample_data", []),
            "null_statistics": result.get("null_statistics", {}),
            "warnings": result.get("warnings", []),
            "recommendations": result.get("recommendations", []),
            "total_matched": result.get("total_matched", 0),
            "total_unmatched": result.get("total_unmatched", 0),
            "next_step": "Review the data and create enrichment if it looks good"
        }

        return json.dumps(response, indent=2)

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to preview enrichment: {str(e)}"
        }, indent=2)


@tool
def list_available_lookups(pipeline_id: str = "") -> str:
    """
    List tables available for lookup JOINs.

    Use this to show the user what tables they can JOIN with.

    Args:
        pipeline_id: Optional pipeline to filter by

    Returns:
        List of available lookup tables with their schemas
    """
    from app.db.models import Pipeline
    from app.services.db_service import db_service
    from app.services.topic_service import topic_service

    user_id = get_user_context()

    try:
        session = db_service._get_session()
        try:
            # Get pipeline if specified
            pipeline = None
            if pipeline_id:
                pipeline = session.query(Pipeline).filter(
                    Pipeline.id == pipeline_id,
                    Pipeline.user_id == user_id
                ).first()

                if not pipeline:
                    return json.dumps({
                        "status": "error",
                        "message": f"Pipeline '{pipeline_id}' not found"
                    }, indent=2)

            # List available topics that can be used as lookup tables
            available_topics = topic_service.list_lookup_topics(user_id, pipeline)

            response = {
                "status": "success",
                "message": f"Found {len(available_topics)} available lookup tables",
                "lookup_tables": available_topics,
                "next_step": "Use create_enrichment to join with these tables"
            }

            return json.dumps(response, indent=2)

        finally:
            session.close()

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to list lookup tables: {str(e)}"
        }, indent=2)


@tool
def get_enrichment_status(enrichment_id: str = "", name: str = "") -> str:
    """
    Get status of an enrichment pipeline.

    Args:
        enrichment_id: ID of the enrichment (optional)
        name: Name of the enrichment (optional)

    Returns:
        Enrichment status including ksqlDB query metrics
    """
    from app.db.models import Pipeline
    from app.services.db_service import db_service

    user_id = get_user_context()

    try:
        if not enrichment_id and not name:
            return json.dumps({
                "status": "error",
                "message": "Either enrichment_id or name is required"
            }, indent=2)

        session = db_service._get_session()
        try:
            # Find enrichment in all pipelines
            pipelines = session.query(Pipeline).filter(
                Pipeline.user_id == user_id
            ).all()

            enrichment = None
            parent_pipeline = None

            for pipeline in pipelines:
                if pipeline.enrichment_config and "enrichments" in pipeline.enrichment_config:
                    for enr in pipeline.enrichment_config["enrichments"]:
                        if (enrichment_id and enr.get("id") == enrichment_id) or \
                           (name and enr.get("name") == name):
                            enrichment = enr
                            parent_pipeline = pipeline
                            break
                    if enrichment:
                        break

            if not enrichment:
                return json.dumps({
                    "status": "error",
                    "message": "Enrichment not found"
                }, indent=2)

            response = {
                "status": "success",
                "enrichment_id": enrichment.get("id"),
                "name": enrichment.get("name"),
                "enrichment_status": enrichment.get("status", "unknown"),
                "pipeline_id": parent_pipeline.id,
                "pipeline_name": parent_pipeline.name,
                "source_topic": enrichment.get("source_topic"),
                "lookup_tables": enrichment.get("lookup_tables"),
                "join_type": enrichment.get("join_type"),
                "output_columns": enrichment.get("output_columns"),
                "created_at": enrichment.get("created_at"),
                "activated_at": enrichment.get("activated_at"),
                "error_message": enrichment.get("error_message")
            }

            # Get ksqlDB query metrics if active
            if enrichment.get("status") == "active" and enrichment.get("ksql_query_id"):
                try:
                    from app.services.clickhouse_service import clickhouse_service
                    metrics = clickhouse_service.get_query_metrics(enrichment["ksql_query_id"])
                    response["metrics"] = metrics
                except Exception as e:
                    response["metrics_error"] = str(e)

            return json.dumps(response, indent=2)

        finally:
            session.close()

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to get enrichment status: {str(e)}"
        }, indent=2)


@tool
def control_enrichment(
    enrichment_id: str,
    action: str
) -> str:
    """
    Control an enrichment pipeline.

    Args:
        enrichment_id: ID of the enrichment
        action: One of "activate", "deactivate", "delete"

    Returns:
        Result of the action
    """
    from app.db.models import Pipeline
    from app.services.db_service import db_service
    from app.services.clickhouse_service import clickhouse_service

    user_id = get_user_context()

    if action not in ['activate', 'deactivate', 'delete']:
        return json.dumps({
            "status": "error",
            "message": f"Invalid action '{action}'. Valid actions: activate, deactivate, delete"
        }, indent=2)

    try:
        session = db_service._get_session()
        try:
            # Find enrichment in all pipelines
            pipelines = session.query(Pipeline).filter(
                Pipeline.user_id == user_id
            ).all()

            enrichment = None
            parent_pipeline = None
            enrichment_index = None

            for pipeline in pipelines:
                if pipeline.enrichment_config and "enrichments" in pipeline.enrichment_config:
                    for idx, enr in enumerate(pipeline.enrichment_config["enrichments"]):
                        if enr.get("id") == enrichment_id:
                            enrichment = enr
                            parent_pipeline = pipeline
                            enrichment_index = idx
                            break
                    if enrichment:
                        break

            if not enrichment:
                return json.dumps({
                    "status": "error",
                    "message": "Enrichment not found"
                }, indent=2)

            # Perform action
            if action == 'activate':
                # Create ksqlDB query
                try:
                    query_id = clickhouse_service.create_enrichment_query(
                        enrichment_id=enrichment["id"],
                        source_topic=enrichment["source_topic"],
                        lookup_tables=enrichment["lookup_tables"],
                        join_keys=enrichment["join_keys"],
                        output_columns=enrichment["output_columns"],
                        join_type=enrichment.get("join_type", "LEFT")
                    )
                    enrichment["status"] = "active"
                    enrichment["ksql_query_id"] = query_id
                    enrichment["activated_at"] = datetime.utcnow().isoformat()
                    message = f"Enrichment '{enrichment['name']}' activated successfully"
                except Exception as e:
                    return json.dumps({
                        "status": "error",
                        "message": f"Failed to activate enrichment: {str(e)}"
                    }, indent=2)

            elif action == 'deactivate':
                if enrichment.get("status") != "active":
                    return json.dumps({
                        "status": "error",
                        "message": "Can only deactivate an active enrichment"
                    }, indent=2)

                # Drop ksqlDB query
                if enrichment.get("ksql_query_id"):
                    try:
                        clickhouse_service.drop_query(enrichment["ksql_query_id"])
                    except Exception as e:
                        pass  # Query might already be deleted

                enrichment["status"] = "inactive"
                enrichment["deactivated_at"] = datetime.utcnow().isoformat()
                message = f"Enrichment '{enrichment['name']}' deactivated successfully"

            elif action == 'delete':
                # Drop ksqlDB query if active
                if enrichment.get("status") == "active" and enrichment.get("ksql_query_id"):
                    try:
                        clickhouse_service.drop_query(enrichment["ksql_query_id"])
                    except Exception as e:
                        pass  # Query might already be deleted

                # Remove from list
                parent_pipeline.enrichment_config["enrichments"].pop(enrichment_index)
                message = f"Enrichment '{enrichment['name']}' deleted successfully"

            # Save changes
            session.commit()

            response = {
                "status": "success",
                "message": message,
                "enrichment_id": enrichment_id,
                "action": action
            }

            return json.dumps(response, indent=2)

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to {action} enrichment: {str(e)}"
        }, indent=2)


@tool
def create_anomaly_template(
    name: str,
    description: str,
    anomaly_config: str
) -> str:
    """
    Create a pipeline template with anomaly detection configuration.

    Use this when the user wants to set up anomaly detection for CDC pipelines.
    This creates a reusable template with detection thresholds.

    Args:
        name: Template name (e.g., "Audit Log Anomaly Detection")
        description: Description of what anomalies to detect
        anomaly_config: JSON string with detection settings:
            - null_ratio: {"enabled": true, "warningThreshold": 5, "errorThreshold": 20}
            - volume_spike: {"enabled": true, "multiplier": 3.0} (3x normal triggers alert)
            - volume_drop: {"enabled": true, "threshold": 0.2} (80% drop triggers alert)
            - gap_detection: {"enabled": true, "minutes": 5} (5 min gap triggers alert)
            - type_coercion: {"enabled": true}
            - cardinality: {"enabled": true, "multiplierThreshold": 2}

    Returns:
        Created template with ID for use in pipelines
    """
    from app.db.models import PipelineTemplate
    from app.services.db_service import db_service
    import uuid

    user_id = get_user_context()

    try:
        # Parse anomaly config
        config = json.loads(anomaly_config) if isinstance(anomaly_config, str) else anomaly_config

        # Validate config structure
        valid_keys = ['null_ratio', 'volume_spike', 'volume_drop', 'gap_detection', 'type_coercion', 'cardinality']
        for key in config:
            if key not in valid_keys:
                return json.dumps({
                    "status": "error",
                    "message": f"Invalid config key '{key}'. Valid keys: {valid_keys}"
                }, indent=2)

        session = db_service._get_session()
        try:
            template = PipelineTemplate(
                id=str(uuid.uuid4()),
                user_id=user_id,
                name=name,
                description=description,
                transforms=[],  # Can be populated later
                anomaly_config=config,
                is_default=False
            )
            session.add(template)
            session.commit()
            session.refresh(template)

            response = {
                "status": "success",
                "message": f"Anomaly detection template '{name}' created successfully",
                "template_id": template.id,
                "name": name,
                "anomaly_config": config,
                "next_step": "Use this template_id when creating a CDC pipeline with create_cdc_pipeline"
            }

            return json.dumps(response, indent=2)

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    except json.JSONDecodeError as e:
        return json.dumps({
            "status": "error",
            "message": f"Invalid JSON in anomaly_config: {str(e)}"
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to create template: {str(e)}"
        }, indent=2)


@tool
def create_alert_rule(
    pipeline_id: str,
    name: str,
    rule_type: str,
    threshold_config: str,
    enabled_days: str = "[4]",
    severity: str = "warning",
    recipients: str = ""
) -> str:
    """
    Create an alert rule for a pipeline to receive notifications.

    Use this when the user wants to receive email alerts for anomalies.
    Alerts can be restricted to specific days (e.g., Friday only).

    Args:
        pipeline_id: ID of the pipeline to monitor
        name: Alert name (e.g., "Friday Volume Alert")
        rule_type: Type of anomaly to alert on:
            - "volume_spike": Alert when event volume exceeds baseline
            - "volume_drop": Alert when event volume drops significantly
            - "gap_detection": Alert when no events for specified duration
            - "null_ratio": Alert when NULL values exceed threshold
        threshold_config: JSON string with thresholds. Examples:
            - volume_spike: {"multiplier": 3.0}
            - volume_drop: {"threshold": 0.2}
            - gap_detection: {"minutes": 5}
            - null_ratio: {"warning": 5, "error": 20}
        enabled_days: JSON array of days to send alerts (0=Mon, 4=Fri, 6=Sun)
            Default "[4]" = Friday only
        severity: Alert severity - "info", "warning", or "critical"
        recipients: Comma-separated email addresses for notifications

    Returns:
        Created alert rule confirmation
    """
    from app.services.alert_service import alert_service

    user_id = get_user_context()

    try:
        # Parse JSON inputs
        threshold = json.loads(threshold_config) if isinstance(threshold_config, str) else threshold_config
        days = json.loads(enabled_days) if isinstance(enabled_days, str) else enabled_days
        recipient_list = [r.strip() for r in recipients.split(',') if r.strip()] if recipients else []

        # Create the rule
        rule = alert_service.create_rule(
            user_id=user_id,
            pipeline_id=pipeline_id,
            name=name,
            rule_type=rule_type,
            threshold_config=threshold,
            enabled_days=days,
            severity=severity,
            recipients=recipient_list
        )

        # Format day names for response
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        enabled_day_names = [day_names[d] for d in days if 0 <= d <= 6]

        response = {
            "status": "success",
            "message": f"Alert rule '{name}' created successfully",
            "rule_id": rule['id'],
            "rule_type": rule_type,
            "enabled_days": enabled_day_names,
            "severity": severity,
            "recipients": recipient_list,
            "threshold_config": threshold,
            "next_step": "Use test_alert to verify the alert configuration"
        }

        return json.dumps(response, indent=2)

    except json.JSONDecodeError as e:
        return json.dumps({
            "status": "error",
            "message": f"Invalid JSON format: {str(e)}"
        }, indent=2)
    except ValueError as e:
        return json.dumps({
            "status": "error",
            "message": str(e)
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to create alert rule: {str(e)}"
        }, indent=2)


@tool
def list_alert_rules(pipeline_id: str = "") -> str:
    """
    List alert rules for the user's pipelines.

    Use this to show the user their configured alert rules.

    Args:
        pipeline_id: Optional - filter by specific pipeline ID

    Returns:
        List of configured alert rules with their settings
    """
    from app.services.alert_service import alert_service

    user_id = get_user_context()

    try:
        rules = alert_service.list_rules(
            user_id=user_id,
            pipeline_id=pipeline_id if pipeline_id else None
        )

        if not rules:
            return json.dumps({
                "status": "success",
                "message": "No alert rules configured",
                "rules": [],
                "next_step": "Use create_alert_rule to set up notifications"
            }, indent=2)

        # Format day names for response
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        for rule in rules:
            enabled_days = rule.get('enabled_days', [])
            rule['enabled_days_display'] = [day_names[d] for d in enabled_days if 0 <= d <= 6]

        response = {
            "status": "success",
            "message": f"Found {len(rules)} alert rule(s)",
            "rules": rules,
            "total_count": len(rules)
        }

        return json.dumps(response, indent=2)

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to list alert rules: {str(e)}"
        }, indent=2)


@tool
def test_alert(rule_id: str) -> str:
    """
    Send a test alert email to verify alert configuration.

    Use this after creating an alert rule to verify it works correctly.
    The test bypasses day/hour restrictions and sends immediately.

    Args:
        rule_id: ID of the alert rule to test

    Returns:
        Test alert result including delivery status
    """
    from app.services.alert_service import alert_service

    user_id = get_user_context()

    try:
        result = alert_service.send_test_alert(rule_id, user_id)

        if result['status'] == 'success':
            response = {
                "status": "success",
                "message": result['message'],
                "alert_history_id": result.get('alert_history_id'),
                "recipients": result.get('recipients', []),
                "note": "Check your email inbox (or Mailhog UI at http://localhost:8025 in development)"
            }
        else:
            response = {
                "status": "error",
                "message": result.get('message', 'Test alert failed')
            }

        return json.dumps(response, indent=2)

    except ValueError as e:
        return json.dumps({
            "status": "error",
            "message": str(e)
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to send test alert: {str(e)}"
        }, indent=2)


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
        generate_dashboard,
        store_credentials,
        discover_schema,
        check_cdc_readiness,
        preview_sample_data,
        # Phase 3: CDC Pipeline tools
        create_cdc_pipeline,
        start_cdc_pipeline,
        get_pipeline_status,
        control_cdc_pipeline,
        list_cdc_pipelines,
        # Phase 4: Enrichment tools
        create_enrichment,
        preview_enrichment,
        list_available_lookups,
        get_enrichment_status,
        control_enrichment,
        # Phase 5: Anomaly Detection & Alerting tools
        create_anomaly_template,
        create_alert_rule,
        list_alert_rules,
        test_alert
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
