"""
Contact / Demo Request API endpoints
"""

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import DemoRequest

router = APIRouter(tags=["contact"])


class DemoRequestCreate(BaseModel):
    """Schema for creating a demo request"""
    name: str
    email: str
    company: str
    role: str | None = None
    message: str | None = None


class DemoRequestResponse(BaseModel):
    """Schema for demo request response"""
    id: str
    name: str
    email: str
    company: str
    role: str | None
    message: str | None
    status: str
    created_at: str


@router.post("/demo-request", response_model=DemoRequestResponse)
async def create_demo_request(
    request: DemoRequestCreate,
    db: Session = Depends(get_db)
):
    """
    Submit a demo request from the contact form.
    Stores the request in the database for follow-up.
    """
    try:
        # Create new demo request
        demo_request = DemoRequest(
            id=str(uuid.uuid4()),
            name=request.name,
            email=request.email,
            company=request.company,
            role=request.role,
            message=request.message,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(demo_request)
        db.commit()
        db.refresh(demo_request)

        return DemoRequestResponse(
            id=demo_request.id,
            name=demo_request.name,
            email=demo_request.email,
            company=demo_request.company,
            role=demo_request.role,
            message=demo_request.message,
            status=demo_request.status,
            created_at=demo_request.created_at.isoformat() + 'Z',
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit request: {str(e)}")


@router.get("/demo-requests")
async def list_demo_requests(
    db: Session = Depends(get_db),
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """
    List all demo requests (for admin use).
    Optional filtering by status.
    """
    query = db.query(DemoRequest).order_by(DemoRequest.created_at.desc())

    if status:
        query = query.filter(DemoRequest.status == status)

    total = query.count()
    requests = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "requests": [r.to_dict() for r in requests],
    }
