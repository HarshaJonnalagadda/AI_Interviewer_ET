from fastapi import Header, HTTPException, status

from app.config import get_settings


async def require_api_key(authorization: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.ai_service_api_key:
        # No key configured — service runs unauthenticated (local dev only).
        return

    expected = f"Bearer {settings.ai_service_api_key}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API key")
