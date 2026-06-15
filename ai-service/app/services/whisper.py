import base64

import httpx

from app.config import get_settings


async def speech_to_text(audio_base64: str) -> str:
    audio_bytes = base64.b64decode(audio_base64)
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {get_settings().openai_api_key}"},
            files={"file": ("audio.webm", audio_bytes, "audio/webm")},
            data={"model": "whisper-1", "language": "en"},
        )
        res.raise_for_status()
        return res.json()["text"]
