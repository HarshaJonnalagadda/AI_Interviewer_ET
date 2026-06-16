import base64

import httpx

from app.config import get_settings

WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions"


async def speech_to_text(audio_base64: str) -> str:
    """English-forced transcription via Whisper."""
    return await _transcribe(audio_base64, language="en")


async def speech_to_text_multilingual(audio_base64: str) -> str:
    """Auto-detect language — handles Telugu/Hindi with English code-switching."""
    return await _transcribe(audio_base64, language=None)


async def _transcribe(audio_base64: str, language: str | None) -> str:
    audio_bytes = base64.b64decode(audio_base64)
    form: dict = {"model": "whisper-1"}
    if language:
        form["language"] = language
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            WHISPER_URL,
            headers={"Authorization": f"Bearer {get_settings().openai_api_key}"},
            files={"file": ("audio.webm", audio_bytes, "audio/webm")},
            data=form,
        )
        res.raise_for_status()
        return res.json()["text"]
