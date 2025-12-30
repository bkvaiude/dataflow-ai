from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from contextlib import asynccontextmanager

from app.config import settings
from app.api.routes import router
from app.services.gemini_service import GeminiService
from app.services.metrics_processor import metrics_processor
from app.services.monitoring_service import monitoring_service

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=['http://localhost:3000', 'http://127.0.0.1:3000']
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting DataFlow AI API in {settings.environment} mode...")
    print(f"  - Gemini: {'REAL' if settings.has_gemini_api_key else 'MOCK'}")
    print(f"  - Kafka: {'REAL' if settings.has_kafka_credentials else 'MOCK'}")
    print(f"  - OAuth: {'REAL' if settings.has_google_oauth_credentials else 'MOCK'}")
    print(f"  - Google Ads Data: {'REAL' if settings.has_google_ads_developer_token else 'MOCK (no developer token)'}")

    app.state.gemini = GeminiService()

    # Start metrics processor if Kafka is configured
    if settings.has_kafka_credentials:
        metrics_processor.start()
        print("  - Metrics Processor: STARTED")

    # Start background monitoring service
    await monitoring_service.start()
    print("  - Monitoring Service: STARTED")

    yield

    # Shutdown
    print("Shutting down DataFlow AI API...")
    await monitoring_service.stop()
    metrics_processor.stop()


app = FastAPI(
    title="DataFlow AI API",
    description="Real-time marketing analytics with Kafka, Flink, and Gemini AI",
    version="0.1.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api")


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "environment": settings.environment}


# Socket.IO events
@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")
    await sio.emit('chat_response', {
        'message': 'Connected to DataFlow AI! How can I help you today?',
        'actions': []
    }, room=sid)


@sio.event
async def chat_message(sid, data):
    """Handle incoming chat message"""
    import json
    from app.services.confirmation_handlers import confirmation_handlers

    user_message = data.get('message', '')
    user_id = data.get('user_id', 'anonymous')

    # Check for reprocess confirmation (legacy)
    reprocess_confirmation = data.get('_reprocess_confirmation')

    # Check for new confirmation types
    confirmation = data.get('_confirmation')

    print(f"Message from {user_id}: {user_message}")

    try:
        # Handle new confirmation types
        if confirmation:
            action_type = confirmation.get('action_type')
            print(f"Processing confirmation: {action_type}")

            if action_type == 'confirm_source_select':
                response = await confirmation_handlers.handle_source_selection(
                    confirmation, user_id
                )
            elif action_type == 'confirm_credentials':
                response = await confirmation_handlers.handle_credential_confirmation(
                    confirmation, user_id
                )
            elif action_type == 'confirm_tables':
                response = await confirmation_handlers.handle_table_confirmation(
                    confirmation, user_id
                )
            elif action_type == 'confirm_destination':
                response = await confirmation_handlers.handle_destination_confirmation(
                    confirmation, user_id
                )
            elif action_type == 'confirm_clickhouse_config':
                response = await confirmation_handlers.handle_clickhouse_config(
                    confirmation, user_id
                )
            elif action_type == 'confirm_schema_preview':
                response = await confirmation_handlers.handle_schema_preview(
                    confirmation, user_id
                )
            elif action_type == 'confirm_topic_registry':
                response = await confirmation_handlers.handle_topic_registry_confirmation(
                    confirmation, user_id
                )
            elif action_type == 'confirm_pipeline_create':
                response = await confirmation_handlers.handle_pipeline_confirmation(
                    confirmation, user_id
                )
            elif action_type == 'confirm_alert_config':
                response = await confirmation_handlers.handle_alert_confirmation(
                    confirmation, user_id
                )
            elif action_type == 'confirm_action':
                response = await confirmation_handlers.handle_generic_confirmation(
                    confirmation, user_id
                )
            else:
                response = {
                    'message': f"Unknown confirmation type: {action_type}",
                    'actions': []
                }

            await sio.emit('chat_response', response, room=sid)
            return

        # Handle reprocess confirmation (legacy)
        if reprocess_confirmation:
            if reprocess_confirmation.get('confirmed'):
                # User confirmed - call create_kafka_pipeline with force_reprocess=True
                from app.tools.agent_tools import create_kafka_pipeline, set_user_context
                set_user_context(user_id)

                result = create_kafka_pipeline.invoke({
                    "connector_id": reprocess_confirmation.get('connectorId', 'google_ads'),
                    "customer_id": reprocess_confirmation.get('customerId', ''),
                    "force_reprocess": True
                })

                # Parse result and send response
                result_data = json.loads(result)
                await sio.emit('chat_response', {
                    'message': f"Reprocessing confirmed! {result_data.get('message', 'Pipeline updated.')}",
                    'actions': []
                }, room=sid)
            else:
                # User skipped reprocessing
                await sio.emit('chat_response', {
                    'message': "No problem! I'll use the existing processed data. You can generate a dashboard with the current data using the generate_dashboard command.",
                    'actions': [{
                        "type": "button",
                        "label": "Generate Dashboard"
                    }]
                }, room=sid)
            return

        # Normal message processing with Gemini agent
        gemini: GeminiService = app.state.gemini
        response = await gemini.process_message(user_message, user_id)

        # Send response back
        await sio.emit('chat_response', {
            'message': response['content'],
            'actions': response.get('actions', [])
        }, room=sid)
    except Exception as e:
        print(f"Error processing message: {e}")
        import traceback
        traceback.print_exc()
        await sio.emit('chat_response', {
            'message': f"Sorry, I encountered an error: {str(e)}",
            'actions': []
        }, room=sid)


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# For running directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:socket_app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.is_development
    )
