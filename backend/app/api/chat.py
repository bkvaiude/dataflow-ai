from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    message: str
    actions: list = []


@router.post("/", response_model=ChatResponse)
async def chat(request: Request, chat_request: ChatRequest):
    """
    HTTP fallback for chat (WebSocket preferred)
    """
    gemini = request.app.state.gemini
    response = await gemini.process_message(
        chat_request.message,
        "http-user"
    )

    return ChatResponse(
        message=response['content'],
        actions=response.get('actions', [])
    )
