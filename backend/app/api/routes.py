from fastapi import APIRouter
from app.api import auth, chat, oauth, connectors, pipeline, credentials, sources, preview, templates, pipelines, ksqldb, enrichments, alerts, contact

router = APIRouter()

# Include sub-routers
router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(chat.router, prefix="/chat", tags=["Chat"])
router.include_router(oauth.router, prefix="/oauth", tags=["OAuth"])
router.include_router(connectors.router, prefix="/connectors", tags=["Connectors"])
router.include_router(pipeline.router, prefix="/pipeline", tags=["Pipeline"])
router.include_router(credentials.router, prefix="/credentials", tags=["Credentials"])
router.include_router(sources.router, prefix="/sources", tags=["Sources"])
router.include_router(preview.router, prefix="/preview", tags=["Preview"])
router.include_router(templates.router, prefix="/templates", tags=["Templates"])
router.include_router(pipelines.router, prefix="/pipelines", tags=["Pipelines"])
router.include_router(ksqldb.router, prefix="/ksqldb", tags=["ksqlDB"])
router.include_router(enrichments.router, prefix="/enrichments", tags=["Enrichments"])
router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
router.include_router(contact.router, prefix="/contact", tags=["Contact"])
