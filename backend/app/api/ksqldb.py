"""
ksqlDB API Routes
Manages ksqlDB streams, tables, and queries for real-time stream processing.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

router = APIRouter()


# ============== Request/Response Models ==============

class KsqlQueryRequest(BaseModel):
    """Request model for executing ksqlDB queries"""
    query: str = Field(..., description="ksqlDB query to execute")
    stream_properties: Optional[Dict[str, Any]] = Field(None, description="Optional stream properties")

    class Config:
        json_schema_extra = {
            "example": {
                "query": "SHOW STREAMS;",
                "stream_properties": {"auto.offset.reset": "earliest"}
            }
        }


class StreamCreateRequest(BaseModel):
    """Request model for creating a stream"""
    name: str = Field(..., description="Stream name")
    topic: str = Field(..., description="Kafka topic name")
    columns: List[Dict[str, str]] = Field(..., description="Column schema")
    value_format: str = Field("AVRO", description="Data format: AVRO, JSON, PROTOBUF")
    key_column: Optional[str] = Field(None, description="Optional key column name")
    partitions: int = Field(3, description="Number of partitions")
    replicas: int = Field(3, description="Replication factor")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "user_stream",
                "topic": "users-topic",
                "columns": [
                    {"name": "id", "type": "STRING"},
                    {"name": "name", "type": "STRING"},
                    {"name": "email", "type": "STRING"}
                ],
                "value_format": "AVRO",
                "key_column": "id",
                "partitions": 3,
                "replicas": 3
            }
        }


class TableCreateRequest(BaseModel):
    """Request model for creating a table"""
    name: str = Field(..., description="Table name")
    topic: str = Field(..., description="Kafka topic name (must be compacted)")
    columns: List[Dict[str, str]] = Field(..., description="Column schema")
    key_column: str = Field(..., description="Primary key column name")
    value_format: str = Field("AVRO", description="Data format: AVRO, JSON, PROTOBUF")
    partitions: int = Field(3, description="Number of partitions")
    replicas: int = Field(3, description="Replication factor")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "user_table",
                "topic": "users-compacted",
                "columns": [
                    {"name": "id", "type": "STRING"},
                    {"name": "name", "type": "STRING"},
                    {"name": "email", "type": "STRING"}
                ],
                "key_column": "id",
                "value_format": "AVRO",
                "partitions": 3,
                "replicas": 3
            }
        }


class StreamInfo(BaseModel):
    """Response model for stream information"""
    name: str
    topic: str
    format: str
    is_windowed: bool = False


class TableInfo(BaseModel):
    """Response model for table information"""
    name: str
    topic: str
    format: str
    key_column: Optional[str] = None


class QueryInfo(BaseModel):
    """Response model for query information"""
    query_id: str
    query_type: str
    query_string: str
    sink_kafka_topic: Optional[str] = None
    status: str


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    ksqldb_url: str
    server_info: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ============== Auth Dependency ==============

async def get_current_user_id(session: str = Query(None)) -> str:
    """Get current user ID from session"""
    from app.api.auth import get_session

    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_data = get_session(session)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid session")

    return user_data["id"]


# ============== Endpoints ==============

@router.get("/health", response_model=HealthResponse)
async def get_ksqldb_health(user_id: str = Depends(get_current_user_id)):
    """
    Check ksqlDB server health.

    Returns connection status and server information.
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        health = await ksqldb_service.health_check()

        if not health.get('healthy'):
            return HealthResponse(
                status="unhealthy",
                ksqldb_url=ksqldb_service.ksqldb_url,
                error=health.get('error', 'Unknown error')
            )

        return HealthResponse(
            status="healthy",
            ksqldb_url=ksqldb_service.ksqldb_url,
            server_info={
                "version": health.get('version'),
                "cluster_id": health.get('cluster_id'),
                "service_id": health.get('service_id')
            }
        )

    except Exception as e:
        return HealthResponse(
            status="error",
            ksqldb_url=ksqldb_service.ksqldb_url,
            error=str(e)
        )


@router.get("/streams")
async def list_streams(user_id: str = Depends(get_current_user_id)):
    """
    List all ksqlDB streams.

    Returns a list of all streams with their metadata.
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        streams = await ksqldb_service.list_streams()
        return {"streams": streams, "count": len(streams)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list streams: {str(e)}")


@router.get("/streams/{stream_name}")
async def describe_stream(
    stream_name: str,
    extended: bool = Query(False, description="Get extended information"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get detailed information about a specific stream.

    Args:
        stream_name: Name of the stream
        extended: If true, returns extended information including topic details
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        if extended:
            result = await ksqldb_service.get_stream_info(stream_name)
        else:
            result = await ksqldb_service.describe_stream(stream_name)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to describe stream: {str(e)}")


@router.post("/streams", status_code=201)
async def create_stream(
    request: StreamCreateRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a new ksqlDB stream.

    Creates a stream that reads from a Kafka topic.
    Streams represent unbounded, append-only data.
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        result = await ksqldb_service.create_stream(
            name=request.name,
            topic=request.topic,
            schema=request.columns,
            value_format=request.value_format,
            key_column=request.key_column,
            partitions=request.partitions,
            replicas=request.replicas
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create stream: {str(e)}")


@router.delete("/streams/{stream_name}")
async def drop_stream(
    stream_name: str,
    delete_topic: bool = Query(False, description="Also delete underlying Kafka topic"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Drop a ksqlDB stream.

    Args:
        stream_name: Name of the stream to drop
        delete_topic: If true, also deletes the underlying Kafka topic (USE WITH CAUTION)
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        result = await ksqldb_service.drop_stream(stream_name, delete_topic)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to drop stream: {str(e)}")


@router.get("/tables")
async def list_tables(user_id: str = Depends(get_current_user_id)):
    """
    List all ksqlDB tables.

    Returns a list of all tables with their metadata.
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        tables = await ksqldb_service.list_tables()
        return {"tables": tables, "count": len(tables)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list tables: {str(e)}")


@router.get("/tables/{table_name}")
async def describe_table(
    table_name: str,
    extended: bool = Query(False, description="Get extended information"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get detailed information about a specific table.

    Args:
        table_name: Name of the table
        extended: If true, returns extended information including topic details
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        if extended:
            result = await ksqldb_service.get_table_info(table_name)
        else:
            result = await ksqldb_service.describe_table(table_name)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to describe table: {str(e)}")


@router.post("/tables", status_code=201)
async def create_table(
    request: TableCreateRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a new ksqlDB table.

    Creates a table that reads from a compacted Kafka topic.
    Tables represent mutable, keyed data (latest value per key).
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        result = await ksqldb_service.create_table(
            name=request.name,
            topic=request.topic,
            schema=request.columns,
            key_column=request.key_column,
            value_format=request.value_format,
            partitions=request.partitions,
            replicas=request.replicas
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create table: {str(e)}")


@router.delete("/tables/{table_name}")
async def drop_table(
    table_name: str,
    delete_topic: bool = Query(False, description="Also delete underlying Kafka topic"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Drop a ksqlDB table.

    Args:
        table_name: Name of the table to drop
        delete_topic: If true, also deletes the underlying Kafka topic (USE WITH CAUTION)
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        result = await ksqldb_service.drop_table(table_name, delete_topic)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to drop table: {str(e)}")


@router.get("/queries")
async def list_queries(user_id: str = Depends(get_current_user_id)):
    """
    List all running ksqlDB queries.

    Returns information about persistent queries (CSAS, CTAS) and push queries.
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        queries = await ksqldb_service.list_queries()
        return {"queries": queries, "count": len(queries)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list queries: {str(e)}")


@router.get("/queries/{query_id}")
async def get_query_status(
    query_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get status and details of a specific query.

    Args:
        query_id: ID of the query (e.g., CTAS_ENRICHED_USERS_1)
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        result = await ksqldb_service.get_query_status(query_id)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get query status: {str(e)}")


@router.post("/query")
async def execute_query(
    request: KsqlQueryRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Execute an ad-hoc ksqlDB query.

    Supports:
    - SHOW STREAMS/TABLES/QUERIES
    - DESCRIBE <stream/table>
    - SELECT queries (for testing)
    - CREATE STREAM/TABLE AS SELECT

    Note: For production streaming queries, use the dedicated endpoints.
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        result = await ksqldb_service.execute_query(request.query)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute query: {str(e)}")


@router.delete("/queries/{query_id}")
async def terminate_query(
    query_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Terminate a running persistent query.

    This will stop the query and clean up resources.
    The underlying Kafka topic will NOT be deleted.

    Args:
        query_id: ID of the query to terminate (e.g., CTAS_ENRICHED_USERS_1)
    """
    from app.services.ksqldb_service import ksqldb_service

    try:
        result = await ksqldb_service.terminate_query(query_id)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to terminate query: {str(e)}")
