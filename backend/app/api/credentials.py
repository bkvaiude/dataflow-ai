"""
Credentials API
Endpoints for managing encrypted database credentials for CDC sources.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

router = APIRouter()


# Request/Response Models
class CredentialCreate(BaseModel):
    """Request model for creating credentials"""
    name: str = Field(..., min_length=1, max_length=255, description="Friendly name for the credential")
    source_type: str = Field(..., description="Database type (postgresql, mysql)")
    host: str = Field(..., description="Database host")
    port: int = Field(..., description="Database port")
    database: str = Field(..., description="Database name")
    username: str = Field(..., description="Database username")
    password: str = Field(..., description="Database password")
    test_connection: bool = Field(True, description="Test connection before storing")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Production PostgreSQL",
                "source_type": "postgresql",
                "host": "db.example.com",
                "port": 5432,
                "database": "myapp",
                "username": "dbuser",
                "password": "securepassword",
                "test_connection": True
            }
        }


class CredentialTestRequest(BaseModel):
    """Request model for testing credentials"""
    source_type: str = Field(..., description="Database type (postgresql, mysql)")
    host: str = Field(..., description="Database host")
    port: int = Field(..., description="Database port")
    database: str = Field(..., description="Database name")
    username: str = Field(..., description="Database username")
    password: str = Field(..., description="Database password")


class CredentialResponse(BaseModel):
    """Response model for credential metadata"""
    id: str
    name: str
    source_type: str
    host: Optional[str] = None
    database: Optional[str] = None
    port: Optional[int] = None
    is_valid: bool
    last_validated_at: Optional[str] = None
    created_at: Optional[str] = None


class CredentialTestResponse(BaseModel):
    """Response model for connection test"""
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None
    version: Optional[str] = None


class CredentialDecryptedResponse(BaseModel):
    """Response model with decrypted credentials"""
    id: str
    name: str
    source_type: str
    credentials: Dict[str, Any]
    is_valid: bool
    last_validated_at: Optional[datetime] = None


# Dependency to get user_id from session
from fastapi import Query
from app.api.auth import get_session

async def get_current_user_id(session: str = Query(None)) -> str:
    """
    Get current authenticated user ID from session.
    """
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_data = get_session(session)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid session")

    return user_data["id"]


@router.post("/", response_model=CredentialResponse, status_code=201)
async def create_credential(
    credential: CredentialCreate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Store new encrypted database credentials

    - **name**: Friendly name for the credential
    - **source_type**: Database type (postgresql, mysql)
    - **host**: Database hostname or IP
    - **port**: Database port
    - **database**: Database name
    - **username**: Database username
    - **password**: Database password
    - **test_connection**: Test connection before storing (default: true)
    """
    from app.services.credential_service import credential_service

    try:
        # Prepare credentials dict
        credentials_dict = {
            'host': credential.host,
            'port': credential.port,
            'database': credential.database,
            'username': credential.username,
            'password': credential.password
        }

        # Store credentials
        result = credential_service.store_credentials(
            user_id=user_id,
            name=credential.name,
            source_type=credential.source_type,
            credentials=credentials_dict,
            test_connection=credential.test_connection
        )

        return CredentialResponse(**result)

    except ValueError as e:
        # Connection test failed
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store credentials: {str(e)}")


@router.get("/", response_model=List[CredentialResponse])
async def list_credentials(user_id: str = Depends(get_current_user_id)):
    """
    List all credentials for the authenticated user

    Returns metadata only (passwords are never returned in list view)
    """
    from app.services.credential_service import credential_service

    try:
        credentials = credential_service.list_credentials(user_id)
        return [CredentialResponse(**c) for c in credentials]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list credentials: {str(e)}")


@router.get("/{credential_id}", response_model=CredentialDecryptedResponse)
async def get_credential(
    credential_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get decrypted credential details

    **WARNING**: This endpoint returns sensitive data including passwords.
    Use with caution and only over HTTPS.
    """
    from app.services.credential_service import credential_service

    try:
        credential = credential_service.get_decrypted_credentials(user_id, credential_id)

        if not credential:
            raise HTTPException(status_code=404, detail="Credential not found")

        return CredentialDecryptedResponse(**credential)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve credential: {str(e)}")


@router.delete("/{credential_id}", status_code=204)
async def delete_credential(
    credential_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Delete a credential

    This will also delete all associated discovered schemas.
    """
    from app.services.credential_service import credential_service

    try:
        deleted = credential_service.delete_credentials(user_id, credential_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Credential not found")

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete credential: {str(e)}")


@router.post("/{credential_id}/test", response_model=CredentialTestResponse)
async def test_credential_connection(
    credential_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Test connection for stored credentials

    Validates that the stored credentials can successfully connect to the database.
    """
    from app.services.credential_service import credential_service

    try:
        # Get decrypted credentials
        credential = credential_service.get_decrypted_credentials(user_id, credential_id)

        if not credential:
            raise HTTPException(status_code=404, detail="Credential not found")

        # Test connection
        result = credential_service.test_connection(
            credential['source_type'],
            credential['credentials']
        )

        return CredentialTestResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test connection: {str(e)}")


@router.post("/test", response_model=CredentialTestResponse)
async def test_connection(
    test_request: CredentialTestRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Test database connection without storing credentials

    Useful for validating credentials before creating them.
    """
    from app.services.credential_service import credential_service

    try:
        credentials_dict = {
            'host': test_request.host,
            'port': test_request.port,
            'database': test_request.database,
            'username': test_request.username,
            'password': test_request.password
        }

        result = credential_service.test_connection(
            test_request.source_type,
            credentials_dict
        )

        return CredentialTestResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test connection: {str(e)}")
