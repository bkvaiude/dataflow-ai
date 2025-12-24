from fastapi import APIRouter
from app.api import auth, chat, oauth, connectors, pipeline

router = APIRouter()

# Include sub-routers
router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(chat.router, prefix="/chat", tags=["Chat"])
router.include_router(oauth.router, prefix="/oauth", tags=["OAuth"])
router.include_router(connectors.router, prefix="/connectors", tags=["Connectors"])
router.include_router(pipeline.router, prefix="/pipeline", tags=["Pipeline"])
