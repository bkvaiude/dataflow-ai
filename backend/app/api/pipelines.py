"""
Pipelines API
CRUD and control endpoints for CDC pipelines.
"""

import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field


router = APIRouter()


# ============== Request/Response Models ==============

class PipelineCreate(BaseModel):
    name: str = Field(..., description="Pipeline name")
    description: Optional[str] = Field(None, description="Pipeline description")
    source_credential_id: str = Field(..., description="Source database credential ID")
    source_tables: List[str] = Field(..., description="Tables to capture (format: schema.table)")
    sink_type: str = Field("clickhouse", description="Sink type: clickhouse, kafka, s3")
    sink_config: Dict[str, Any] = Field(default_factory=dict, description="Sink configuration")
    template_id: Optional[str] = Field(None, description="Optional transform template ID")


class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    source_tables: Optional[List[str]] = None
    sink_config: Optional[Dict[str, Any]] = None
    template_id: Optional[str] = None


class PipelineResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str]
    source_credential_id: str
    source_tables: List[str]
    source_connector_name: Optional[str]
    sink_type: str
    sink_config: Dict[str, Any]
    sink_connector_name: Optional[str]
    template_id: Optional[str]
    status: str
    last_health_check: Optional[str]
    error_message: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]
    started_at: Optional[str]
    stopped_at: Optional[str]


class PipelineHealthResponse(BaseModel):
    pipeline_id: str
    pipeline_name: str
    status: str
    source_connector: Optional[Dict[str, Any]]
    sink_connector: Optional[Dict[str, Any]]
    errors: List[Dict[str, Any]]
    last_health_check: str
    pipeline_status: str
    started_at: Optional[str]


class PipelineEventResponse(BaseModel):
    id: str
    pipeline_id: str
    event_type: str
    message: Optional[str]
    details: Optional[Dict[str, Any]]
    created_at: Optional[str]


# ============== Auth Dependency ==============
from app.utils.auth_dependencies import get_current_user_id


# ============== Helper Functions ==============

def get_db_session():
    """Get database session"""
    from app.services.db_service import db_service
    return db_service._get_session()


# ============== CRUD Endpoints ==============

@router.post("/", response_model=PipelineResponse, status_code=201)
async def create_pipeline(
    request: PipelineCreate,
    user_id: str = Depends(get_current_user_id)
):
    """Create a new CDC pipeline"""
    from app.db.models import Pipeline, Credential

    session = get_db_session()
    try:
        # Verify credential exists and belongs to user
        credential = session.query(Credential).filter(
            Credential.id == request.source_credential_id,
            Credential.user_id == user_id
        ).first()

        if not credential:
            raise HTTPException(status_code=404, detail="Source credential not found")

        # Create pipeline
        pipeline = Pipeline(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=request.name,
            description=request.description,
            source_credential_id=request.source_credential_id,
            source_tables=request.source_tables,
            sink_type=request.sink_type,
            sink_config=request.sink_config,
            template_id=request.template_id,
            status="pending"
        )

        session.add(pipeline)
        session.commit()
        session.refresh(pipeline)

        # Log creation event
        from app.services.pipeline_monitor import pipeline_monitor
        pipeline_monitor.log_event(
            pipeline.id,
            "created",
            f"Pipeline '{request.name}' created"
        )

        return PipelineResponse(**pipeline.to_dict())

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create pipeline: {str(e)}")
    finally:
        session.close()


@router.get("/", response_model=List[PipelineResponse])
async def list_pipelines(user_id: str = Depends(get_current_user_id)):
    """List all active pipelines for the current user (excludes deleted)"""
    from app.db.models import Pipeline

    session = get_db_session()
    try:
        pipelines = session.query(Pipeline).filter(
            Pipeline.user_id == user_id,
            Pipeline.deleted_at.is_(None)  # Exclude soft-deleted
        ).order_by(Pipeline.created_at.desc()).all()

        return [PipelineResponse(**p.to_dict()) for p in pipelines]

    finally:
        session.close()


@router.get("/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(
    pipeline_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Get a specific pipeline (excludes deleted)"""
    from app.db.models import Pipeline

    session = get_db_session()
    try:
        pipeline = session.query(Pipeline).filter(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == user_id,
            Pipeline.deleted_at.is_(None)  # Exclude soft-deleted
        ).first()

        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        return PipelineResponse(**pipeline.to_dict())

    finally:
        session.close()


@router.put("/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(
    pipeline_id: str,
    request: PipelineUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """Update a pipeline"""
    from app.db.models import Pipeline

    session = get_db_session()
    try:
        pipeline = session.query(Pipeline).filter(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == user_id,
            Pipeline.deleted_at.is_(None)  # Exclude soft-deleted
        ).first()

        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        # Only allow updates when pipeline is not running
        if pipeline.status == "running":
            raise HTTPException(
                status_code=400,
                detail="Cannot update a running pipeline. Stop it first."
            )

        # Update fields
        if request.name is not None:
            pipeline.name = request.name
        if request.description is not None:
            pipeline.description = request.description
        if request.source_tables is not None:
            pipeline.source_tables = request.source_tables
        if request.sink_config is not None:
            pipeline.sink_config = request.sink_config
        if request.template_id is not None:
            pipeline.template_id = request.template_id

        pipeline.updated_at = datetime.utcnow()
        session.commit()
        session.refresh(pipeline)

        return PipelineResponse(**pipeline.to_dict())

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update pipeline: {str(e)}")
    finally:
        session.close()


@router.delete("/{pipeline_id}")
async def delete_pipeline(
    pipeline_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Soft delete a pipeline and cleanup all external resources.

    - Keeps pipeline and events in database for history
    - Cleans up Kafka topics, ksqlDB resources, connectors for cost optimization
    """
    from app.db.models import Pipeline, EnrichmentConfig
    from app.services.confluent_connector_service import confluent_connector_service
    from app.services.topic_service import topic_service
    from app.services.ksqldb_service import ksqldb_service

    session = get_db_session()
    cleanup_results = {
        "connectors": [],
        "enrichments": [],
        "topics": [],
        "schema_subjects": [],
        "ksqldb_resources": [],
        "errors": []
    }

    try:
        pipeline = session.query(Pipeline).filter(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == user_id,
            Pipeline.deleted_at.is_(None)  # Only find non-deleted pipelines
        ).first()

        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        server_name = f"dataflow_{pipeline_id[:8]}"
        print(f"[PIPELINE] Starting cleanup for pipeline {pipeline_id}")

        # 1. Cleanup enrichments (deactivate ksqlDB resources)
        enrichments = session.query(EnrichmentConfig).filter(
            EnrichmentConfig.pipeline_id == pipeline_id
        ).all()

        for enrichment in enrichments:
            try:
                # Terminate ksqlDB query if active
                if enrichment.status == 'active' and enrichment.ksqldb_query_id:
                    try:
                        await ksqldb_service.terminate_query(enrichment.ksqldb_query_id)
                        cleanup_results["ksqldb_resources"].append(f"query:{enrichment.ksqldb_query_id}")
                        print(f"[PIPELINE] Terminated ksqlDB query: {enrichment.ksqldb_query_id}")
                    except Exception as e:
                        cleanup_results["errors"].append(f"Query {enrichment.ksqldb_query_id}: {e}")

                # Drop output stream (with topic)
                if enrichment.output_stream_name:
                    try:
                        await ksqldb_service.drop_stream(enrichment.output_stream_name, delete_topic=True)
                        cleanup_results["ksqldb_resources"].append(f"stream:{enrichment.output_stream_name}")
                    except Exception as e:
                        cleanup_results["errors"].append(f"Stream {enrichment.output_stream_name}: {e}")

                # Drop source stream
                if enrichment.source_stream_name:
                    try:
                        await ksqldb_service.drop_stream(enrichment.source_stream_name)
                        cleanup_results["ksqldb_resources"].append(f"stream:{enrichment.source_stream_name}")
                    except Exception as e:
                        cleanup_results["errors"].append(f"Stream {enrichment.source_stream_name}: {e}")

                # Drop lookup tables
                if enrichment.lookup_tables:
                    for table_config in enrichment.lookup_tables:
                        table_name = table_config.get('ksqldb_table')
                        if table_name:
                            try:
                                await ksqldb_service.drop_table(table_name)
                                cleanup_results["ksqldb_resources"].append(f"table:{table_name}")
                            except Exception as e:
                                cleanup_results["errors"].append(f"Table {table_name}: {e}")

                # Mark enrichment as stopped
                enrichment.status = 'stopped'
                cleanup_results["enrichments"].append(enrichment.id)
                print(f"[PIPELINE] Cleaned up enrichment: {enrichment.id}")

            except Exception as e:
                cleanup_results["errors"].append(f"Enrichment {enrichment.id}: {e}")

        # 2. Delete Kafka topics (list by prefix and delete)
        try:
            all_topics = topic_service.list_topics(prefix=server_name)
            enriched_topics = topic_service.list_topics(prefix=f"enriched_{pipeline_id[:8]}")
            topics_to_delete = list(set(all_topics + enriched_topics))

            for topic in topics_to_delete:
                try:
                    topic_service.delete_topic(topic)
                    cleanup_results["topics"].append(topic)
                    print(f"[PIPELINE] Deleted topic: {topic}")
                except Exception as e:
                    cleanup_results["errors"].append(f"Topic {topic}: {e}")

        except Exception as e:
            cleanup_results["errors"].append(f"Topic listing: {e}")

        # 3. Delete Schema Registry subjects
        try:
            subjects = topic_service.list_subjects()
            pipeline_subjects = [s for s in subjects if server_name in s]

            for subject in pipeline_subjects:
                try:
                    topic_service.delete_subject(subject, permanent=True)
                    cleanup_results["schema_subjects"].append(subject)
                    print(f"[PIPELINE] Deleted schema subject: {subject}")
                except Exception as e:
                    cleanup_results["errors"].append(f"Subject {subject}: {e}")

        except Exception as e:
            cleanup_results["errors"].append(f"Schema subjects: {e}")

        # 4. Delete connectors
        if pipeline.source_connector_name:
            try:
                confluent_connector_service.delete_connector(pipeline.source_connector_name)
                cleanup_results["connectors"].append(pipeline.source_connector_name)
                print(f"[PIPELINE] Deleted source connector: {pipeline.source_connector_name}")
            except Exception as e:
                cleanup_results["errors"].append(f"Source connector: {e}")

        if pipeline.sink_connector_name:
            try:
                confluent_connector_service.delete_connector(pipeline.sink_connector_name)
                cleanup_results["connectors"].append(pipeline.sink_connector_name)
                print(f"[PIPELINE] Deleted sink connector: {pipeline.sink_connector_name}")
            except Exception as e:
                cleanup_results["errors"].append(f"Sink connector: {e}")

        # 5. Soft delete - keep history but mark as deleted
        pipeline.deleted_at = datetime.utcnow()
        pipeline.status = "deleted"
        pipeline.source_connector_name = None
        pipeline.sink_connector_name = None

        session.commit()

        print(f"[PIPELINE] Soft deleted pipeline {pipeline_id}. Cleanup: {cleanup_results}")

        return {
            "message": "Pipeline deleted successfully",
            "cleanup": cleanup_results
        }

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete pipeline: {str(e)}")
    finally:
        session.close()


# ============== Control Endpoints ==============

@router.post("/{pipeline_id}/start")
async def start_pipeline(
    pipeline_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Start a pipeline (deploy connectors)"""
    from app.db.models import Pipeline
    from app.services.confluent_connector_service import confluent_connector_service
    from app.services.pipeline_monitor import pipeline_monitor

    session = get_db_session()
    try:
        pipeline = session.query(Pipeline).filter(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == user_id,
            Pipeline.deleted_at.is_(None)  # Exclude soft-deleted
        ).first()

        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        if pipeline.status == "running":
            raise HTTPException(status_code=400, detail="Pipeline is already running")

        # Create source connector
        try:
            connector_result = confluent_connector_service.create_source_connector(
                user_id=user_id,
                credential_id=pipeline.source_credential_id,
                pipeline_id=pipeline_id,
                tables=pipeline.source_tables,
                snapshot_mode="initial"
            )
            pipeline.source_connector_name = connector_result['connector_name']
        except Exception as e:
            pipeline.status = "failed"
            pipeline.error_message = f"Failed to create source connector: {str(e)}"
            session.commit()
            pipeline_monitor.log_event(pipeline_id, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e))

        # Update pipeline status
        pipeline.status = "running"
        pipeline.started_at = datetime.utcnow()
        pipeline.error_message = None
        session.commit()

        pipeline_monitor.log_event(pipeline_id, "started", f"Pipeline '{pipeline.name}' started")

        return {
            "message": "Pipeline started successfully",
            "status": "running",
            "source_connector": pipeline.source_connector_name
        }

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to start pipeline: {str(e)}")
    finally:
        session.close()


@router.post("/{pipeline_id}/stop")
async def stop_pipeline(
    pipeline_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Stop a pipeline (delete connectors)"""
    from app.db.models import Pipeline
    from app.services.confluent_connector_service import confluent_connector_service
    from app.services.pipeline_monitor import pipeline_monitor

    session = get_db_session()
    try:
        pipeline = session.query(Pipeline).filter(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == user_id,
            Pipeline.deleted_at.is_(None)  # Exclude soft-deleted
        ).first()

        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        if pipeline.status == "stopped":
            raise HTTPException(status_code=400, detail="Pipeline is already stopped")

        # Delete connectors
        if pipeline.source_connector_name:
            try:
                confluent_connector_service.delete_connector(pipeline.source_connector_name)
            except Exception as e:
                print(f"[PIPELINE] Warning: Failed to delete source connector: {e}")

        if pipeline.sink_connector_name:
            try:
                confluent_connector_service.delete_connector(pipeline.sink_connector_name)
            except Exception as e:
                print(f"[PIPELINE] Warning: Failed to delete sink connector: {e}")

        # Update pipeline status
        pipeline.status = "stopped"
        pipeline.stopped_at = datetime.utcnow()
        pipeline.source_connector_name = None
        pipeline.sink_connector_name = None
        session.commit()

        pipeline_monitor.log_event(pipeline_id, "stopped", f"Pipeline '{pipeline.name}' stopped")

        return {"message": "Pipeline stopped successfully", "status": "stopped"}

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to stop pipeline: {str(e)}")
    finally:
        session.close()


@router.post("/{pipeline_id}/pause")
async def pause_pipeline(
    pipeline_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Pause a running pipeline"""
    from app.db.models import Pipeline
    from app.services.confluent_connector_service import confluent_connector_service
    from app.services.pipeline_monitor import pipeline_monitor

    session = get_db_session()
    try:
        pipeline = session.query(Pipeline).filter(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == user_id,
            Pipeline.deleted_at.is_(None)  # Exclude soft-deleted
        ).first()

        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        if pipeline.status != "running":
            raise HTTPException(status_code=400, detail="Can only pause a running pipeline")

        # Pause connectors
        if pipeline.source_connector_name:
            confluent_connector_service.pause_connector(pipeline.source_connector_name)

        if pipeline.sink_connector_name:
            confluent_connector_service.pause_connector(pipeline.sink_connector_name)

        pipeline.status = "paused"
        session.commit()

        pipeline_monitor.log_event(pipeline_id, "paused", f"Pipeline '{pipeline.name}' paused")

        return {"message": "Pipeline paused successfully", "status": "paused"}

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to pause pipeline: {str(e)}")
    finally:
        session.close()


@router.post("/{pipeline_id}/resume")
async def resume_pipeline(
    pipeline_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Resume a paused pipeline"""
    from app.db.models import Pipeline
    from app.services.confluent_connector_service import confluent_connector_service
    from app.services.pipeline_monitor import pipeline_monitor

    session = get_db_session()
    try:
        pipeline = session.query(Pipeline).filter(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == user_id,
            Pipeline.deleted_at.is_(None)  # Exclude soft-deleted
        ).first()

        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        if pipeline.status != "paused":
            raise HTTPException(status_code=400, detail="Can only resume a paused pipeline")

        # Resume connectors
        if pipeline.source_connector_name:
            confluent_connector_service.resume_connector(pipeline.source_connector_name)

        if pipeline.sink_connector_name:
            confluent_connector_service.resume_connector(pipeline.sink_connector_name)

        pipeline.status = "running"
        session.commit()

        pipeline_monitor.log_event(pipeline_id, "resumed", f"Pipeline '{pipeline.name}' resumed")

        return {"message": "Pipeline resumed successfully", "status": "running"}

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to resume pipeline: {str(e)}")
    finally:
        session.close()


# ============== Monitoring Endpoints ==============

@router.get("/{pipeline_id}/health", response_model=PipelineHealthResponse)
async def get_pipeline_health(
    pipeline_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Get pipeline health status"""
    from app.db.models import Pipeline
    from app.services.pipeline_monitor import pipeline_monitor

    session = get_db_session()
    try:
        # Verify ownership
        pipeline = session.query(Pipeline).filter(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == user_id,
            Pipeline.deleted_at.is_(None)  # Exclude soft-deleted
        ).first()

        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        health = pipeline_monitor.get_pipeline_health(pipeline_id)
        return PipelineHealthResponse(**health)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get health: {str(e)}")
    finally:
        session.close()


@router.get("/{pipeline_id}/metrics")
async def get_pipeline_metrics(
    pipeline_id: str,
    window_seconds: int = 60,
    user_id: str = Depends(get_current_user_id)
):
    """Get pipeline metrics (lag, throughput)"""
    from app.db.models import Pipeline
    from app.services.pipeline_monitor import pipeline_monitor

    session = get_db_session()
    try:
        # Verify ownership
        pipeline = session.query(Pipeline).filter(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == user_id,
            Pipeline.deleted_at.is_(None)  # Exclude soft-deleted
        ).first()

        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        lag = pipeline_monitor.get_lag_metrics(pipeline_id)
        throughput = pipeline_monitor.get_throughput_metrics(pipeline_id, window_seconds)

        return {
            "pipeline_id": pipeline_id,
            "lag": lag,
            "throughput": throughput
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")
    finally:
        session.close()


@router.get("/{pipeline_id}/events", response_model=List[PipelineEventResponse])
async def get_pipeline_events(
    pipeline_id: str,
    limit: int = 50,
    user_id: str = Depends(get_current_user_id)
):
    """Get pipeline event log"""
    from app.db.models import Pipeline, PipelineEvent

    session = get_db_session()
    try:
        # Verify ownership
        pipeline = session.query(Pipeline).filter(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == user_id
        ).first()

        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        events = session.query(PipelineEvent).filter(
            PipelineEvent.pipeline_id == pipeline_id
        ).order_by(PipelineEvent.created_at.desc()).limit(limit).all()

        return [PipelineEventResponse(**e.to_dict()) for e in events]

    finally:
        session.close()
