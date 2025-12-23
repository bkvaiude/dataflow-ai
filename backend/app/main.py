from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from contextlib import asynccontextmanager

from app.config import settings
from app.api.routes import router
from app.services.gemini_service import GeminiService

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=['http://localhost:3000', 'http://127.0.0.1:3000']
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting DataFlow AI API in {settings.environment} mode...")
    app.state.gemini = GeminiService()
    yield
    # Shutdown
    print("Shutting down DataFlow AI API...")


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
    user_message = data.get('message', '')
    user_id = data.get('user_id', 'anonymous')

    print(f"Message from {user_id}: {user_message}")

    try:
        # Process with Gemini agent
        gemini: GeminiService = app.state.gemini
        response = await gemini.process_message(user_message, user_id)

        # Send response back
        await sio.emit('chat_response', {
            'message': response['content'],
            'actions': response.get('actions', [])
        }, room=sid)
    except Exception as e:
        print(f"Error processing message: {e}")
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
