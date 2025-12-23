from fastapi import APIRouter
from app.api import chat, oauth, connectors

router = APIRouter()

# Include sub-routers
router.include_router(chat.router, prefix="/chat", tags=["Chat"])
router.include_router(oauth.router, prefix="/oauth", tags=["OAuth"])
router.include_router(connectors.router, prefix="/connectors", tags=["Connectors"])
