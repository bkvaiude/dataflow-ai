"""
Preview API
Endpoints for sampling data and simulating transformations.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

router = APIRouter()


# Request/Response Models
class SampleDataRequest(BaseModel):
    """Request model for sampling data"""
    credential_id: str = Field(..., description="Credential ID")
    table_name: str = Field(..., description="Table name to sample")
    schema_name: str = Field("public", description="Schema name (default: public)")
    limit: int = Field(100, ge=1, le=1000, description="Number of rows to fetch (1-1000)")
    columns: Optional[List[str]] = Field(None, description="Specific columns to fetch (null = all)")

    class Config:
        json_schema_extra = {
            "example": {
                "credential_id": "cred-123",
                "table_name": "users",
                "schema_name": "public",
                "limit": 100,
                "columns": ["id", "name", "email"]
            }
        }


class TransformJoinRequest(BaseModel):
    """Request model for JOIN transformation"""
    credential_id: str = Field(..., description="Credential ID")
    left_table: str = Field(..., description="Left table name")
    right_table: str = Field(..., description="Right table name")
    join_type: str = Field(..., description="JOIN type (INNER, LEFT, RIGHT, FULL)")
    left_key: str = Field(..., description="Column name in left table")
    right_key: str = Field(..., description="Column name in right table")
    schema_name: str = Field("public", description="Schema name (default: public)")
    limit: int = Field(100, ge=1, le=1000, description="Row limit (1-1000)")

    class Config:
        json_schema_extra = {
            "example": {
                "credential_id": "cred-123",
                "left_table": "orders",
                "right_table": "customers",
                "join_type": "INNER",
                "left_key": "customer_id",
                "right_key": "id",
                "schema": "public",
                "limit": 100
            }
        }


class TransformFilterRequest(BaseModel):
    """Request model for FILTER transformation"""
    credential_id: str = Field(..., description="Credential ID")
    table_name: str = Field(..., description="Table name")
    where_clause: str = Field(..., description="WHERE clause (without 'WHERE' keyword)")
    schema_name: str = Field("public", description="Schema name (default: public)")
    limit: int = Field(100, ge=1, le=1000, description="Row limit (1-1000)")

    class Config:
        json_schema_extra = {
            "example": {
                "credential_id": "cred-123",
                "table_name": "orders",
                "where_clause": "status = 'completed' AND total > 100",
                "schema": "public",
                "limit": 100
            }
        }


class AggregationSpec(BaseModel):
    """Aggregation specification"""
    column: str = Field(..., description="Column to aggregate")
    function: str = Field(..., description="Aggregation function (COUNT, SUM, AVG, MIN, MAX, STDDEV, VARIANCE)")
    alias: Optional[str] = Field(None, description="Alias for the result column")


class TransformAggregationRequest(BaseModel):
    """Request model for AGGREGATION transformation"""
    credential_id: str = Field(..., description="Credential ID")
    table_name: str = Field(..., description="Table name")
    group_by: List[str] = Field(..., description="Columns to group by")
    aggregations: List[AggregationSpec] = Field(..., description="Aggregation specifications")
    schema_name: str = Field("public", description="Schema name (default: public)")
    limit: int = Field(100, ge=1, le=1000, description="Row limit (1-1000)")

    class Config:
        json_schema_extra = {
            "example": {
                "credential_id": "cred-123",
                "table_name": "orders",
                "group_by": ["customer_id", "status"],
                "aggregations": [
                    {"column": "total", "function": "SUM", "alias": "total_amount"},
                    {"column": "id", "function": "COUNT", "alias": "order_count"}
                ],
                "schema": "public",
                "limit": 100
            }
        }


class AnalyzeAnomaliesRequest(BaseModel):
    """Request model for anomaly analysis"""
    original_data: Dict[str, Any] = Field(..., description="Original sample data")
    transformed_data: Dict[str, Any] = Field(..., description="Transformed data")
    transformation_type: str = Field(..., description="Type of transformation (join, filter, aggregation)")
    config: Optional[Dict[str, Any]] = Field(None, description="Anomaly detection configuration")


class AnalyzeSampleRequest(BaseModel):
    """Request model for simple sample data analysis"""
    data: Dict[str, Any] = Field(..., description="Sample data to analyze")
    thresholds: Optional[Dict[str, Any]] = Field(None, description="Anomaly threshold configuration")


# ============== Auth Dependency ==============
from app.utils.auth_dependencies import get_current_user_id


@router.post("/sample")
async def fetch_sample_data(
    request: SampleDataRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Fetch sample data from a database table

    - **credential_id**: ID of stored credentials
    - **table_name**: Table to sample from
    - **schema_name**: Schema name (default: public)
    - **limit**: Number of rows to fetch (1-1000)
    - **columns**: Optional list of specific columns to fetch
    """
    from app.services.sample_data_service import sample_data_service

    try:
        result = sample_data_service.fetch_sample(
            user_id=user_id,
            credential_id=request.credential_id,
            table_name=request.table_name,
            schema_name=request.schema_name,
            limit=request.limit,
            columns=request.columns
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sample data: {str(e)}")


@router.post("/transform/join")
async def simulate_join_transform(
    request: TransformJoinRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Simulate a JOIN transformation

    - **credential_id**: ID of stored credentials
    - **left_table**: Left table name
    - **right_table**: Right table name
    - **join_type**: JOIN type (INNER, LEFT, RIGHT, FULL)
    - **left_key**: Join column in left table
    - **right_key**: Join column in right table
    - **schema_name**: Schema name (default: public)
    - **limit**: Row limit (1-1000)
    """
    from app.services.transform_simulator import transform_simulator

    try:
        result = transform_simulator.simulate_join(
            user_id=user_id,
            credential_id=request.credential_id,
            left_table=request.left_table,
            right_table=request.right_table,
            join_type=request.join_type,
            left_key=request.left_key,
            right_key=request.right_key,
            schema=request.schema_name,
            limit=request.limit
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to simulate JOIN: {str(e)}")


@router.post("/transform/filter")
async def simulate_filter_transform(
    request: TransformFilterRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Simulate a FILTER (WHERE) transformation

    - **credential_id**: ID of stored credentials
    - **table_name**: Table to filter
    - **where_clause**: WHERE clause (without 'WHERE' keyword)
    - **schema_name**: Schema name (default: public)
    - **limit**: Row limit (1-1000)
    """
    from app.services.transform_simulator import transform_simulator

    try:
        result = transform_simulator.simulate_filter(
            user_id=user_id,
            credential_id=request.credential_id,
            table_name=request.table_name,
            where_clause=request.where_clause,
            schema=request.schema_name,
            limit=request.limit
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to simulate FILTER: {str(e)}")


@router.post("/transform/aggregation")
async def simulate_aggregation_transform(
    request: TransformAggregationRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Simulate an AGGREGATION transformation

    - **credential_id**: ID of stored credentials
    - **table_name**: Table to aggregate
    - **group_by**: List of columns to group by
    - **aggregations**: List of aggregation specs
    - **schema_name**: Schema name (default: public)
    - **limit**: Row limit (1-1000)
    """
    from app.services.transform_simulator import transform_simulator

    try:
        # Convert Pydantic models to dicts
        aggregations_list = [agg.dict() for agg in request.aggregations]

        result = transform_simulator.simulate_aggregation(
            user_id=user_id,
            credential_id=request.credential_id,
            table_name=request.table_name,
            group_by=request.group_by,
            aggregations=aggregations_list,
            schema=request.schema_name,
            limit=request.limit
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to simulate AGGREGATION: {str(e)}")


@router.post("/analyze")
async def analyze_anomalies(
    request: AnalyzeAnomaliesRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Analyze transformed data for anomalies

    - **original_data**: Original sample data (before transformation)
    - **transformed_data**: Transformed data (after transformation)
    - **transformation_type**: Type of transformation (join, filter, aggregation)
    - **config**: Optional anomaly detection configuration
    """
    from app.services.anomaly_detector import anomaly_detector

    try:
        result = anomaly_detector.analyze(
            original_data=request.original_data,
            transformed_data=request.transformed_data,
            transformation_type=request.transformation_type,
            config=request.config
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze anomalies: {str(e)}")


@router.post("/analyze-sample")
async def analyze_sample_data(
    request: AnalyzeSampleRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Analyze sample data for data quality issues (NULLs, etc.)

    - **data**: Sample data with columns and rows
    - **thresholds**: Optional anomaly threshold configuration
    """
    try:
        data = request.data
        thresholds = request.thresholds or {}

        columns = data.get("columns", [])
        rows = data.get("rows", [])
        row_count = data.get("row_count", len(rows))

        anomalies = []
        errors = 0
        warnings = 0
        info = 0

        # NULL ratio thresholds
        null_config = thresholds.get("null_ratio", {})
        null_enabled = null_config.get("enabled", True) if isinstance(null_config, dict) else True
        warning_threshold = null_config.get("warning_threshold", 5) if isinstance(null_config, dict) else 5
        error_threshold = null_config.get("error_threshold", 20) if isinstance(null_config, dict) else 20

        if null_enabled and row_count > 0:
            for col_idx, col in enumerate(columns):
                null_count = sum(1 for row in rows if len(row) > col_idx and (row[col_idx] is None))
                null_percentage = (null_count / row_count) * 100

                if null_percentage > 0:
                    if null_percentage >= error_threshold:
                        severity = "error"
                        errors += 1
                    elif null_percentage >= warning_threshold:
                        severity = "warning"
                        warnings += 1
                    else:
                        severity = "info"
                        info += 1

                    anomalies.append({
                        "type": "null_ratio",
                        "severity": severity,
                        "column": col.get("name", f"column_{col_idx}"),
                        "message": f"Column '{col.get('name', f'column_{col_idx}')}' has {null_percentage:.1f}% NULL values ({null_count} of {row_count} rows)",
                        "details": {
                            "nullCount": null_count,
                            "totalCount": row_count,
                            "nullPercentage": null_percentage,
                            "threshold": warning_threshold if severity == "warning" else error_threshold
                        }
                    })

        return {
            "anomalies": anomalies,
            "summary": {
                "totalAnomalies": len(anomalies),
                "errors": errors,
                "warnings": warnings,
                "info": info
            },
            "can_proceed": errors == 0
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze sample data: {str(e)}")
