"""
Alerts API
Endpoints for managing pipeline alert rules and viewing alert history.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

router = APIRouter()


# Request/Response Models
class AlertRuleCreate(BaseModel):
    """Request model for creating an alert rule"""
    pipeline_id: Optional[str] = Field(None, description="Pipeline to monitor (optional)")
    name: str = Field(..., min_length=1, max_length=255, description="Alert name")
    description: Optional[str] = Field(None, description="Alert description")
    rule_type: str = Field(..., description="Rule type: volume_spike, volume_drop, gap_detection, null_ratio")
    threshold_config: Dict[str, Any] = Field(..., description="Detection thresholds")
    enabled_days: List[int] = Field(default=[4], description="Days to send alerts (0=Mon, 6=Sun)")
    enabled_hours: Optional[List[int]] = Field(None, description="Hours to send alerts (0-23)")
    cooldown_minutes: int = Field(default=30, ge=1, le=1440, description="Cooldown between alerts")
    severity: str = Field(default="warning", description="Severity: info, warning, critical")
    recipients: List[str] = Field(default=[], description="Email recipients")

    class Config:
        json_schema_extra = {
            "example": {
                "pipeline_id": "pipeline-123",
                "name": "Friday Volume Alert",
                "description": "Alert when event volume spikes",
                "rule_type": "volume_spike",
                "threshold_config": {"multiplier": 3.0},
                "enabled_days": [4],
                "cooldown_minutes": 30,
                "severity": "warning",
                "recipients": ["admin@company.com"]
            }
        }


class AlertRuleUpdate(BaseModel):
    """Request model for updating an alert rule"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    threshold_config: Optional[Dict[str, Any]] = None
    enabled_days: Optional[List[int]] = None
    enabled_hours: Optional[List[int]] = None
    cooldown_minutes: Optional[int] = Field(None, ge=1, le=1440)
    severity: Optional[str] = None
    recipients: Optional[List[str]] = None
    is_active: Optional[bool] = None


class AlertRuleResponse(BaseModel):
    """Response model for alert rule"""
    id: str
    user_id: str
    pipeline_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    rule_type: str
    threshold_config: Dict[str, Any]
    enabled_days: List[int]
    enabled_hours: Optional[List[int]] = None
    cooldown_minutes: int
    severity: str
    recipients: Optional[List[str]] = None
    is_active: bool
    last_triggered_at: Optional[str] = None
    trigger_count: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AlertHistoryResponse(BaseModel):
    """Response model for alert history"""
    id: str
    rule_id: str
    alert_type: str
    severity: str
    title: str
    message: str
    details: Optional[Dict[str, Any]] = None
    email_sent: bool
    email_sent_at: Optional[str] = None
    email_recipients: Optional[List[str]] = None
    email_error: Optional[str] = None
    triggered_at: Optional[str] = None


class TestAlertResponse(BaseModel):
    """Response model for test alert"""
    status: str
    message: str
    alert_history_id: Optional[str] = None
    recipients: List[str] = []


# ============== Auth Dependency ==============
from app.utils.auth_dependencies import get_current_user_id


@router.post("/rules", response_model=AlertRuleResponse, status_code=201)
async def create_alert_rule(
    rule: AlertRuleCreate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a new alert rule

    - **pipeline_id**: Optional pipeline to monitor
    - **name**: Alert name
    - **rule_type**: Type of anomaly to detect (volume_spike, volume_drop, gap_detection, null_ratio)
    - **threshold_config**: Detection thresholds specific to the rule type
    - **enabled_days**: Days to send alerts (0=Monday, 4=Friday, 6=Sunday)
    - **severity**: Alert severity level
    - **recipients**: Email addresses to notify
    """
    from app.services.alert_service import alert_service

    try:
        result = alert_service.create_rule(
            user_id=user_id,
            pipeline_id=rule.pipeline_id,
            name=rule.name,
            description=rule.description,
            rule_type=rule.rule_type,
            threshold_config=rule.threshold_config,
            enabled_days=rule.enabled_days,
            enabled_hours=rule.enabled_hours,
            cooldown_minutes=rule.cooldown_minutes,
            severity=rule.severity,
            recipients=rule.recipients
        )

        return AlertRuleResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create alert rule: {str(e)}")


@router.get("/rules", response_model=List[AlertRuleResponse])
async def list_alert_rules(
    pipeline_id: Optional[str] = Query(None, description="Filter by pipeline ID"),
    active_only: bool = Query(False, description="Only return active rules"),
    user_id: str = Depends(get_current_user_id)
):
    """
    List all alert rules for the authenticated user

    Optional filters:
    - **pipeline_id**: Filter by specific pipeline
    - **active_only**: Only return active rules
    """
    from app.services.alert_service import alert_service

    try:
        rules = alert_service.list_rules(
            user_id=user_id,
            pipeline_id=pipeline_id,
            active_only=active_only
        )
        return [AlertRuleResponse(**r) for r in rules]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list alert rules: {str(e)}")


@router.get("/rules/{rule_id}", response_model=AlertRuleResponse)
async def get_alert_rule(
    rule_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get a specific alert rule by ID
    """
    from app.services.alert_service import alert_service

    try:
        rule = alert_service.get_rule(rule_id, user_id)

        if not rule:
            raise HTTPException(status_code=404, detail="Alert rule not found")

        return AlertRuleResponse(**rule)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get alert rule: {str(e)}")


@router.put("/rules/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    rule_id: str,
    rule_update: AlertRuleUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Update an alert rule

    Only provided fields will be updated.
    """
    from app.services.alert_service import alert_service

    try:
        updates = rule_update.model_dump(exclude_unset=True)
        result = alert_service.update_rule(rule_id, user_id, updates)

        return AlertRuleResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update alert rule: {str(e)}")


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_alert_rule(
    rule_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Delete an alert rule
    """
    from app.services.alert_service import alert_service

    try:
        alert_service.delete_rule(rule_id, user_id)
        return None

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete alert rule: {str(e)}")


@router.post("/rules/{rule_id}/test", response_model=TestAlertResponse)
async def test_alert_rule(
    rule_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Send a test alert to verify the configuration

    This bypasses day/hour restrictions and sends immediately.
    """
    from app.services.alert_service import alert_service

    try:
        result = alert_service.send_test_alert(rule_id, user_id)
        return TestAlertResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send test alert: {str(e)}")


@router.get("/history", response_model=List[AlertHistoryResponse])
async def get_alert_history(
    rule_id: Optional[str] = Query(None, description="Filter by rule ID"),
    limit: int = Query(50, ge=1, le=200, description="Max results to return"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get alert history

    - **rule_id**: Optional filter by specific rule
    - **limit**: Maximum number of results (default 50, max 200)
    """
    from app.services.alert_service import alert_service

    try:
        history = alert_service.get_history(
            user_id=user_id,
            rule_id=rule_id,
            limit=limit
        )
        return [AlertHistoryResponse(**h) for h in history]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get alert history: {str(e)}")


@router.post("/check-now")
async def trigger_monitoring_check(
    pipeline_id: Optional[str] = Query(None, description="Specific pipeline to check"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Manually trigger a monitoring check for anomalies.

    This runs the anomaly detection immediately instead of waiting for the background loop.
    Useful for testing and debugging.

    - **pipeline_id**: Optional specific pipeline to check (checks all if not provided)
    """
    from app.services.monitoring_service import monitoring_service

    try:
        result = monitoring_service.check_now(pipeline_id)
        return {
            "status": "success",
            "message": "Monitoring check completed",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run monitoring check: {str(e)}")
