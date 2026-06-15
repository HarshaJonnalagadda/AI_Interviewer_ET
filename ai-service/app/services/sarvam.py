import httpx

from app.config import get_settings

SARVAM_BASE = "https://api.sarvam.ai"

LANG_CODES = {"te": "te-IN", "hi": "hi-IN"}


async def speech_to_text(audio_base64: str, language: str) -> str:
    lang_code = LANG_CODES[language]
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{SARVAM_BASE}/speech-to-text",
            headers={
                "api-subscription-key": get_settings().sarvam_api_key,
                "Content-Type": "application/json",
            },
            json={
                "model": "saaras:v3",
                "language_code": lang_code,
                "audio": audio_base64,
                "with_timestamps": False,
            },
        )
        res.raise_for_status()
        return res.json()["transcript"]


async def text_to_speech(text: str, language: str) -> str:
    lang_code = LANG_CODES[language]
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{SARVAM_BASE}/text-to-speech",
            headers={
                "api-subscription-key": get_settings().sarvam_api_key,
                "Content-Type": "application/json",
            },
            json={
                "inputs": [text],
                "target_language_code": lang_code,
                "speaker": "meera",
                "model": "bulbul:v3",
                "enable_preprocessing": True,
            },
        )
        res.raise_for_status()
        return res.json()["audios"][0]


async def translate(text: str, source_language: str) -> str:
    lang_code = LANG_CODES[source_language]
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{SARVAM_BASE}/translate",
            headers={
                "api-subscription-key": get_settings().sarvam_api_key,
                "Content-Type": "application/json",
            },
            json={
                "input": text,
                "source_language_code": lang_code,
                "target_language_code": "en-IN",
                "model": "mayura:v1",
            },
        )
        res.raise_for_status()
        return res.json()["translated_text"]
