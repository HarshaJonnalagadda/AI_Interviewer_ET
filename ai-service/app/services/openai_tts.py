import base64

import httpx

from app.config import get_settings

OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"


async def text_to_speech(text: str) -> tuple[str, str]:
    """Returns (audio_base64, mime_type). Uses OpenAI TTS-1 which handles any language."""
    settings = get_settings()
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            OPENAI_TTS_URL,
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"model": "tts-1", "voice": "nova", "input": text},
        )
        res.raise_for_status()
    return base64.b64encode(res.content).decode(), "audio/mpeg"
