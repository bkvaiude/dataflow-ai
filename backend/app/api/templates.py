"""
Templates API
Endpoints for managing pipeline templates.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

router = APIRouter()


# Request/Response Models
class TemplateCreate(BaseModel):
    """Request model for creating a template"""
    name: str = Field(..., min_length=1, max_length=255, description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    transforms: List[Dict[str, Any]] = Field(..., description="List of transformation configurations")
    anomaly_config: Dict[str, Any] = Field(..., description="Anomaly detection configuration")
    is_default: bool = Field(False, description="Whether this is a default template")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Sales Pipeline",
                "description": "Standard sales data transformation pipeline",
                "transforms": [
                    {
                        "type": "filter",
                        "params": {
                            "table_name": "orders",
                            "where_clause": "status = 'completed'",
                            "schema": "public"
                        }
                    },
                    {
                        "type": "aggregation",
                        "params": {
                            "table_name": "orders",
                            "group_by": ["customer_id"],
                            "aggregations": [
                                {"column": "total", "function": "SUM", "alias": "total_sales"}
                            ],
                            "schema": "public"
                        }
                    }
                ],
                "anomaly_config": {
                    "null_ratio_warning": 0.05,
                    "null_ratio_error": 0.20,
                    "cardinality_multiplier": 2.0,
                    "row_count_drop_warning": 0.50
                },
                "is_default": False
            }
        }


class TemplateUpdate(BaseModel):
    """Request model for updating a template"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    transforms: Optional[List[Dict[str, Any]]] = Field(None, description="List of transformation configurations")
    anomaly_config: Optional[Dict[str, Any]] = Field(None, description="Anomaly detection configuration")
    is_default: Optional[bool] = Field(None, description="Whether this is a default template")


class TemplateResponse(BaseModel):
    """Response model for template"""
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    transforms: List[Dict[str, Any]]
    anomaly_config: Dict[str, Any]
    is_default: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ApplyTemplateRequest(BaseModel):
    """Request model for applying a template"""
    credential_id: str = Field(..., description="Credential ID to run transforms against")

    class Config:
        json_schema_extra = {
            "example": {
                "credential_id": "cred-123"
            }
        }


# ============== Auth Dependency ==============
from app.utils.auth_dependencies import get_current_user_id


@router.post("/", response_model=TemplateResponse, status_code=201)
async def create_template(
    template: TemplateCreate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a new pipeline template

    - **name**: Template name
    - **description**: Optional description
    - **transforms**: List of transformation configurations
    - **anomaly_config**: Anomaly detection thresholds
    - **is_default**: Whether this is a default template
    """
    from app.services.template_service import template_service

    try:
        result = template_service.create_template(
            user_id=user_id,
            name=template.name,
            transforms=template.transforms,
            anomaly_config=template.anomaly_config,
            description=template.description,
            is_default=template.is_default
        )

        return TemplateResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create template: {str(e)}")


@router.get("/", response_model=List[TemplateResponse])
async def list_templates(user_id: str = Depends(get_current_user_id)):
    """
    List all templates for the authenticated user

    Templates are ordered by is_default (descending) then created_at (descending)
    """
    from app.services.template_service import template_service

    try:
        templates = template_service.list_templates(user_id)
        return [TemplateResponse(**t) for t in templates]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list templates: {str(e)}")


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get a specific template by ID
    """
    from app.services.template_service import template_service

    try:
        template = template_service.get_template(user_id, template_id)

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        return TemplateResponse(**template)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get template: {str(e)}")


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    template_update: TemplateUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Update a template

    Only provided fields will be updated. Omitted fields remain unchanged.
    """
    from app.services.template_service import template_service

    try:
        result = template_service.update_template(
            user_id=user_id,
            template_id=template_id,
            name=template_update.name,
            description=template_update.description,
            transforms=template_update.transforms,
            anomaly_config=template_update.anomaly_config,
            is_default=template_update.is_default
        )

        if not result:
            raise HTTPException(status_code=404, detail="Template not found")

        return TemplateResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update template: {str(e)}")


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Delete a template
    """
    from app.services.template_service import template_service

    try:
        deleted = template_service.delete_template(user_id, template_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Template not found")

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete template: {str(e)}")


@router.post("/{template_id}/apply")
async def apply_template(
    template_id: str,
    request: ApplyTemplateRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Apply a template by running all transforms in sequence

    This will:
    1. Execute each transformation in order
    2. Analyze each result for anomalies
    3. Stop if critical errors are found
    4. Return results for all executed transforms

    - **credential_id**: ID of credentials to run transforms against
    """
    from app.services.template_service import template_service

    try:
        result = template_service.apply_template(
            user_id=user_id,
            template_id=template_id,
            credential_id=request.credential_id
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply template: {str(e)}")
