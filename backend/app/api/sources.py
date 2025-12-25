"""
Sources API
Endpoints for schema discovery and CDC readiness checks.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

router = APIRouter()


# Request/Response Models
class SchemaDiscoveryRequest(BaseModel):
    """Request model for schema discovery"""
    credential_id: str = Field(..., description="ID of stored credentials")
    schema_filter: str = Field("public", description="Database schema to discover")
    include_row_counts: bool = Field(False, description="Whether to estimate row counts (slower)")
    table_filter: Optional[List[str]] = Field(None, description="List of specific tables to discover")

    class Config:
        json_schema_extra = {
            "example": {
                "credential_id": "abc-123",
                "schema_filter": "public",
                "include_row_counts": False,
                "table_filter": ["users", "orders"]
            }
        }


class CDCReadinessRequest(BaseModel):
    """Request model for CDC readiness check"""
    credential_id: str = Field(..., description="ID of stored credentials")
    tables: Optional[List[str]] = Field(None, description="List of fully qualified table names (e.g., 'public.users')")

    class Config:
        json_schema_extra = {
            "example": {
                "credential_id": "abc-123",
                "tables": ["public.users", "public.orders"]
            }
        }


class TableDiscoveryResponse(BaseModel):
    """Response model for discovered table"""
    schema_name: str
    table_name: str
    columns: List[Dict[str, Any]]
    primary_keys: List[str]
    foreign_keys: List[Dict[str, Any]]
    row_count_estimate: Optional[int]
    table_size_bytes: Optional[int]
    has_primary_key: bool
    cdc_eligible: bool
    cdc_issues: List[str]
    replica_identity: Optional[str]


class SchemaDiscoveryResponse(BaseModel):
    """Response model for schema discovery"""
    credential_id: str
    schema_name: str
    tables: List[Dict[str, Any]]
    table_count: int
    relationship_graph: Dict[str, Any]
    discovered_at: str


class CDCReadinessResponse(BaseModel):
    """Response model for CDC readiness check"""
    overall_ready: bool
    provider: str
    provider_name: str
    server_version: str
    checks: Dict[str, Any]
    table_checks: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    checked_at: str


# Dependency to get user_id (mock for now, replace with real auth)
async def get_current_user_id() -> str:
    """
    Get current authenticated user ID.
    TODO: Replace with real authentication
    """
    # For development, return a test user ID
    # In production, this should extract user_id from JWT token
    return "test-user-id"


@router.post("/discover", response_model=SchemaDiscoveryResponse)
async def discover_schema(
    request: SchemaDiscoveryRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Discover database schema from stored credentials

    This endpoint:
    - Connects to the PostgreSQL database using stored credentials
    - Discovers all tables in the specified schema
    - Extracts column information, data types, constraints
    - Identifies primary keys and foreign key relationships
    - Checks CDC eligibility for each table
    - Builds a relationship graph showing table dependencies
    - Stores discovered metadata in the database for caching

    **Use this to:**
    - Explore available tables before setting up CDC
    - Identify which tables are eligible for CDC streaming
    - Understand table relationships and dependencies
    - Get table size and row count estimates
    """
    from app.services.schema_discovery_service import schema_discovery_service

    try:
        result = schema_discovery_service.discover(
            user_id=user_id,
            credential_id=request.credential_id,
            schema_filter=request.schema_filter,
            include_row_counts=request.include_row_counts,
            table_filter=request.table_filter
        )

        return SchemaDiscoveryResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schema discovery failed: {str(e)}")


@router.post("/check-readiness", response_model=CDCReadinessResponse)
async def check_cdc_readiness(
    request: CDCReadinessRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Check if database is ready for Change Data Capture (CDC)

    This endpoint validates:
    - **WAL Level**: Must be set to 'logical' for CDC
    - **Replication Privilege**: User must have replication permission
    - **Replication Slots**: Available slots for CDC connections
    - **WAL Senders**: Available WAL sender processes
    - **Table Readiness**: Primary keys and REPLICA IDENTITY settings

    Returns provider-specific instructions to fix any issues.

    **Supported Providers:**
    - AWS RDS PostgreSQL
    - Supabase
    - Google Cloud SQL
    - Azure Database for PostgreSQL
    - Self-Hosted PostgreSQL

    **Use this to:**
    - Validate database configuration before starting CDC
    - Get step-by-step fix instructions for your specific provider
    - Check individual table readiness for CDC streaming
    """
    from app.services.cdc_readiness_service import cdc_readiness_service

    try:
        result = cdc_readiness_service.check_readiness(
            user_id=user_id,
            credential_id=request.credential_id,
            tables=request.tables
        )

        return CDCReadinessResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CDC readiness check failed: {str(e)}")


@router.get("/schemas/{credential_id}", response_model=List[Dict[str, Any]])
async def get_discovered_schemas(
    credential_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get previously discovered schemas from cache

    Returns cached schema discovery results without re-querying the database.
    Useful for displaying previously discovered schemas without additional database load.
    """
    from app.services.schema_discovery_service import schema_discovery_service

    try:
        schemas = schema_discovery_service.get_discovered_schemas(
            user_id=user_id,
            credential_id=credential_id
        )

        return schemas

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve schemas: {str(e)}")
