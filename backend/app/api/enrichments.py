"""
Enrichments API
Endpoints for managing stream-table JOIN enrichments using ksqlDB.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
# IDs are strings (compatible with Google OAuth IDs), not UUIDs
import uuid

router = APIRouter()


# ============== Request/Response Models ==============

class LookupTableSchema(BaseModel):
    """Schema for lookup table configuration"""
    topic: str = Field(..., description="Kafka topic for lookup data")
    key: str = Field(..., description="Primary key column name")
    alias: str = Field(..., description="Table alias for JOIN (e.g., 'u' for users)")
    ksqldb_table: Optional[str] = Field(None, description="ksqlDB table name (auto-generated if not provided)")

    class Config:
        json_schema_extra = {
            "example": {
                "topic": "users_topic",
                "key": "user_id",
                "alias": "u",
                "ksqldb_table": "USERS_TABLE"
            }
        }


class JoinKeySchema(BaseModel):
    """Schema for JOIN key mapping"""
    stream_column: str = Field(..., description="Column name in source stream")
    table_column: str = Field(..., description="Column name in lookup table")
    table_alias: Optional[str] = Field(None, description="Table alias (if multiple tables)")

    class Config:
        json_schema_extra = {
            "example": {
                "stream_column": "user_id",
                "table_column": "id",
                "table_alias": "u"
            }
        }


class EnrichmentCreate(BaseModel):
    """Request model for creating enrichment"""
    pipeline_id: str = Field(..., description="Pipeline ID this enrichment belongs to")
    name: str = Field(..., min_length=1, max_length=255, description="Enrichment name")
    description: Optional[str] = Field(None, description="Enrichment description")
    source_topic: str = Field(..., description="Source Kafka topic to enrich")
    lookup_tables: List[LookupTableSchema] = Field(..., description="Lookup tables to join")
    join_keys: List[JoinKeySchema] = Field(..., description="JOIN key mappings")
    output_columns: List[str] = Field(..., description="Output columns to include (e.g., ['s.id', 'u.name'])")
    join_type: str = Field("LEFT", description="JOIN type: LEFT or INNER")

    class Config:
        json_schema_extra = {
            "example": {
                "pipeline_id": "12345678-1234-1234-1234-123456789012",
                "name": "User Profile Enrichment",
                "description": "Enrich events with user profile data",
                "source_topic": "user_events",
                "lookup_tables": [
                    {
                        "topic": "users_topic",
                        "key": "user_id",
                        "alias": "u"
                    }
                ],
                "join_keys": [
                    {
                        "stream_column": "user_id",
                        "table_column": "id"
                    }
                ],
                "output_columns": ["s.event_id", "s.event_type", "u.name", "u.email"],
                "join_type": "LEFT"
            }
        }


class EnrichmentUpdate(BaseModel):
    """Request model for updating enrichment"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    output_columns: Optional[List[str]] = None


class EnrichmentResponse(BaseModel):
    """Response model for enrichment"""
    id: str
    pipeline_id: str
    user_id: str
    name: str
    description: Optional[str]
    source_stream_name: str
    source_topic: str
    lookup_tables: List[Dict[str, Any]]
    join_type: str
    join_keys: List[Dict[str, Any]]
    output_columns: List[str]
    output_stream_name: str
    output_topic: str
    ksqldb_query_id: Optional[str]
    status: str
    created_at: Optional[str]
    updated_at: Optional[str]
    activated_at: Optional[str]


class EnrichmentStatusResponse(BaseModel):
    """Response model for enrichment status"""
    id: str
    name: str
    status: str
    created_at: Optional[str]
    activated_at: Optional[str]
    ksqldb_query_status: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class EnrichmentPreviewRequest(BaseModel):
    """Request model for previewing enrichment"""
    source_topic: str = Field(..., description="Source Kafka topic")
    lookup_tables: List[LookupTableSchema] = Field(..., description="Lookup tables")
    join_keys: List[JoinKeySchema] = Field(..., description="JOIN keys")
    output_columns: List[str] = Field(..., description="Output columns")
    join_type: str = Field("LEFT", description="JOIN type")
    limit: int = Field(10, ge=1, le=100, description="Number of sample rows")


class EnrichmentPreviewResponse(BaseModel):
    """Response model for preview"""
    source_topic: str
    lookup_tables: List[Dict[str, Any]]
    sample_data: List[Dict[str, Any]]
    row_count: int
    null_stats: Optional[Dict[str, Any]] = None
    warnings: List[str] = []


class EnrichmentValidationRequest(BaseModel):
    """Request model for validation"""
    source_topic: str
    lookup_tables: List[LookupTableSchema]
    join_keys: List[JoinKeySchema]
    output_columns: List[str]


class EnrichmentValidationResponse(BaseModel):
    """Response model for validation"""
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []


# ============== Auth Dependency ==============
from app.utils.auth_dependencies import get_current_user_id


# ============== Helper Functions ==============

def get_db_session():
    """Get database session"""
    from app.services.db_service import db_service
    return db_service._get_session()


# ============== CRUD Endpoints ==============

@router.post("/", response_model=EnrichmentResponse, status_code=status.HTTP_201_CREATED)
async def create_enrichment(
    request: EnrichmentCreate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a new enrichment configuration.

    This creates an enrichment configuration that will join a source stream
    with one or more lookup tables using ksqlDB. The enrichment must be
    activated separately to deploy it to ksqlDB.

    - **pipeline_id**: Pipeline this enrichment belongs to
    - **name**: Descriptive name for the enrichment
    - **source_topic**: Kafka topic containing source data
    - **lookup_tables**: List of lookup tables to join
    - **join_keys**: How to join stream and tables
    - **output_columns**: Which columns to include in output
    - **join_type**: LEFT or INNER join
    """
    from app.db.models import Pipeline, EnrichmentConfig
    from app.services.enrichment_service import enrichment_service

    session = get_db_session()
    try:
        # Verify pipeline exists and belongs to user
        pipeline = session.query(Pipeline).filter(
            Pipeline.id == request.pipeline_id,
            Pipeline.user_id == user_id
        ).first()

        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        # Convert Pydantic models to dicts for service layer
        lookup_tables_dict = [table.model_dump() for table in request.lookup_tables]
        join_keys_dict = [key.model_dump() for key in request.join_keys]

        # Create enrichment via service
        enrichment = await enrichment_service.create_enrichment(
            db=session,
            user_id=user_id,
            pipeline_id=request.pipeline_id,
            name=request.name,
            source_topic=request.source_topic,
            lookup_tables=lookup_tables_dict,
            join_keys=join_keys_dict,
            output_columns=request.output_columns,
            join_type=request.join_type,
            description=request.description
        )

        return EnrichmentResponse(**enrichment.to_dict())

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create enrichment: {str(e)}")
    finally:
        session.close()


@router.get("/", response_model=List[EnrichmentResponse])
async def list_enrichments(
    pipeline_id: Optional[str] = Query(None, description="Filter by pipeline ID"),
    user_id: str = Depends(get_current_user_id)
):
    """
    List all enrichments for the current user.

    Optionally filter by pipeline_id to get enrichments for a specific pipeline.
    """
    from app.services.enrichment_service import enrichment_service

    session = get_db_session()
    try:
        enrichments = await enrichment_service.list_enrichments(
            db=session,
            user_id=user_id,
            pipeline_id=pipeline_id
        )

        return [EnrichmentResponse(**e.to_dict()) for e in enrichments]

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid UUID: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list enrichments: {str(e)}")
    finally:
        session.close()


@router.get("/{enrichment_id}", response_model=EnrichmentResponse)
async def get_enrichment(
    enrichment_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get details for a specific enrichment.

    Returns complete configuration including JOIN logic, output columns,
    and current status.
    """
    from app.services.enrichment_service import enrichment_service

    session = get_db_session()
    try:
        enrichment = await enrichment_service.get_enrichment(
            db=session,
            enrichment_id=enrichment_id,
            user_id=user_id
        )

        if not enrichment:
            raise HTTPException(status_code=404, detail="Enrichment not found")

        return EnrichmentResponse(**enrichment.to_dict())

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid UUID: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get enrichment: {str(e)}")
    finally:
        session.close()


@router.put("/{enrichment_id}", response_model=EnrichmentResponse)
async def update_enrichment(
    enrichment_id: str,
    request: EnrichmentUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Update enrichment configuration.

    Only certain fields can be updated:
    - name
    - description
    - output_columns

    The enrichment must be stopped to update. JOIN logic cannot be changed
    after creation - delete and recreate instead.
    """
    from app.services.enrichment_service import enrichment_service

    session = get_db_session()
    try:
        # Convert to dict, excluding None values
        updates = request.model_dump(exclude_none=True)

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        enrichment = await enrichment_service.update_enrichment(
            db=session,
            enrichment_id=enrichment_id,
            user_id=user_id,
            updates=updates
        )

        if not enrichment:
            raise HTTPException(status_code=404, detail="Enrichment not found")

        return EnrichmentResponse(**enrichment.to_dict())

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid UUID: {str(e)}")
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update enrichment: {str(e)}")
    finally:
        session.close()


@router.delete("/{enrichment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_enrichment(
    enrichment_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Delete an enrichment.

    If the enrichment is active, it will be automatically deactivated first.
    This will terminate the ksqlDB query and remove the configuration.
    """
    from app.services.enrichment_service import enrichment_service

    session = get_db_session()
    try:
        deleted = await enrichment_service.delete_enrichment(
            db=session,
            enrichment_id=enrichment_id,
            user_id=user_id
        )

        if not deleted:
            raise HTTPException(status_code=404, detail="Enrichment not found")

        return None

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid UUID: {str(e)}")
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete enrichment: {str(e)}")
    finally:
        session.close()


# ============== Control Endpoints ==============

@router.post("/{enrichment_id}/activate", response_model=EnrichmentStatusResponse)
async def activate_enrichment(
    enrichment_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Deploy enrichment to ksqlDB.

    This will:
    1. Create source stream from Kafka topic
    2. Create lookup tables from reference topics
    3. Create continuous JOIN query
    4. Start streaming enriched data to output topic

    The enrichment status will be updated to 'active' and a ksqlDB query ID
    will be assigned.
    """
    from app.services.enrichment_service import enrichment_service

    session = get_db_session()
    try:
        result = await enrichment_service.activate_enrichment(
            db=session,
            enrichment_id=enrichment_id,
            user_id=user_id
        )

        # Get updated enrichment for response
        enrichment = await enrichment_service.get_enrichment(
            db=session,
            enrichment_id=enrichment_id,
            user_id=user_id
        )

        if not enrichment:
            raise HTTPException(status_code=404, detail="Enrichment not found")

        return EnrichmentStatusResponse(
            id=enrichment.id,
            name=enrichment.name,
            status=enrichment.status,
            created_at=enrichment.created_at.isoformat() if enrichment.created_at else None,
            activated_at=enrichment.activated_at.isoformat() if enrichment.activated_at else None,
            ksqldb_query_status=result.get('query_result'),
            metrics=None
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to activate enrichment: {str(e)}")
    finally:
        session.close()


@router.post("/{enrichment_id}/deactivate", response_model=EnrichmentStatusResponse)
async def deactivate_enrichment(
    enrichment_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Stop enrichment ksqlDB query.

    This will terminate the continuous JOIN query in ksqlDB.
    The configuration is preserved and can be reactivated later.
    """
    from app.services.enrichment_service import enrichment_service

    session = get_db_session()
    try:
        result = await enrichment_service.deactivate_enrichment(
            db=session,
            enrichment_id=enrichment_id,
            user_id=user_id
        )

        # Get updated enrichment for response
        enrichment = await enrichment_service.get_enrichment(
            db=session,
            enrichment_id=enrichment_id,
            user_id=user_id
        )

        if not enrichment:
            raise HTTPException(status_code=404, detail="Enrichment not found")

        return EnrichmentStatusResponse(
            id=enrichment.id,
            name=enrichment.name,
            status=enrichment.status,
            created_at=enrichment.created_at.isoformat() if enrichment.created_at else None,
            activated_at=enrichment.activated_at.isoformat() if enrichment.activated_at else None,
            ksqldb_query_status=None,
            metrics=None
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to deactivate enrichment: {str(e)}")
    finally:
        session.close()


@router.get("/{enrichment_id}/status", response_model=EnrichmentStatusResponse)
async def get_enrichment_status(
    enrichment_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get enrichment status with ksqlDB metrics.

    If the enrichment is active, this will also fetch real-time metrics
    from ksqlDB including:
    - Messages processed
    - Processing rate
    - Query status

    For inactive enrichments, only basic status is returned.
    """
    from app.services.enrichment_service import enrichment_service

    session = get_db_session()
    try:
        status = await enrichment_service.get_enrichment_status(
            db=session,
            enrichment_id=enrichment_id,
            user_id=user_id
        )

        return EnrichmentStatusResponse(
            id=status['enrichment_id'],
            name=status['name'],
            status=status['status'],
            created_at=status.get('created_at'),
            activated_at=status.get('activated_at'),
            ksqldb_query_status=status.get('query_metrics'),
            metrics=status.get('query_metrics')
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")
    finally:
        session.close()


# ============== Preview & Validation Endpoints ==============

@router.post("/preview", response_model=EnrichmentPreviewResponse)
async def preview_enrichment(
    request: EnrichmentPreviewRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Preview what enriched data would look like.

    This fetches sample data from the source topic and lookup tables,
    performs an in-memory JOIN simulation, and returns sample results.

    Useful for validating JOIN logic before deploying to ksqlDB.

    - **limit**: Number of sample rows (1-100)
    """
    from app.services.enrichment_service import enrichment_service

    try:
        # Convert Pydantic models to dicts
        lookup_tables_dict = [table.model_dump() for table in request.lookup_tables]
        join_keys_dict = [key.model_dump() for key in request.join_keys]

        result = await enrichment_service.preview_enrichment(
            source_topic=request.source_topic,
            lookup_tables=lookup_tables_dict,
            join_keys=join_keys_dict,
            output_columns=request.output_columns,
            join_type=request.join_type,
            limit=request.limit
        )

        return EnrichmentPreviewResponse(
            source_topic=result.get('source_topic', request.source_topic),
            lookup_tables=result.get('lookup_tables', lookup_tables_dict),
            sample_data=result.get('sample_rows', []),
            row_count=len(result.get('sample_rows', [])),
            null_stats=result.get('null_stats'),
            warnings=result.get('warnings', [])
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview enrichment: {str(e)}")


@router.post("/validate", response_model=EnrichmentValidationResponse)
async def validate_enrichment(
    request: EnrichmentValidationRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Validate enrichment configuration before creation.

    This checks:
    - Topic existence
    - Schema compatibility
    - JOIN key type matching
    - Output column availability
    - ksqlDB syntax validity

    Returns validation errors and warnings without creating the enrichment.
    """
    from app.services.enrichment_service import enrichment_service

    try:
        # Convert Pydantic models to dicts
        lookup_tables_dict = [table.model_dump() for table in request.lookup_tables]
        join_keys_dict = [key.model_dump() for key in request.join_keys]

        result = await enrichment_service.validate_enrichment(
            source_topic=request.source_topic,
            lookup_tables=lookup_tables_dict,
            join_keys=join_keys_dict,
            output_columns=request.output_columns
        )

        return EnrichmentValidationResponse(
            valid=result['valid'],
            errors=result.get('errors', []),
            warnings=result.get('warnings', [])
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate enrichment: {str(e)}")
