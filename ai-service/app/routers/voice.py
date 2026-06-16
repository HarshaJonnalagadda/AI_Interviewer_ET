import logging

from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_api_key
from app.schemas import (
    SttRequest,
    SttResponse,
    TranslateRequest,
    TranslateResponse,
    TtsRequest,
    TtsResponse,
)
from app.services import elevenlabs, sarvam, whisper
from app.services import openai_tts
from app.services.claude import complete

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_api_key)])


@router.post("/stt", response_model=SttResponse)
async def stt(req: SttRequest) -> SttResponse:
    if req.language == "en":
        transcript = await whisper.speech_to_text(req.audio_base64)
    elif req.language in ("te", "hi"):
        try:
            transcript = await sarvam.speech_to_text(req.audio_base64, req.language)
        except Exception:
            logger.exception("Sarvam STT failed, falling back to Whisper (multilingual)")
            transcript = await whisper.speech_to_text_multilingual(req.audio_base64)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {req.language}")
    return SttResponse(transcript=transcript)


@router.post("/tts", response_model=TtsResponse)
async def tts(req: TtsRequest) -> TtsResponse:
    if req.language == "en":
        try:
            audio = await elevenlabs.text_to_speech(req.text)
            return TtsResponse(audio_base64=audio, mime_type="audio/mpeg")
        except Exception:
            logger.exception("ElevenLabs TTS failed, falling back to OpenAI TTS")
            audio, mime_type = await openai_tts.text_to_speech(req.text)
            return TtsResponse(audio_base64=audio, mime_type=mime_type)

    elif req.language in ("te", "hi"):
        try:
            audio = await sarvam.text_to_speech(req.text, req.language)
            return TtsResponse(audio_base64=audio, mime_type="audio/wav")
        except Exception:
            logger.exception("Sarvam TTS failed, falling back to OpenAI TTS")
            audio, mime_type = await openai_tts.text_to_speech(req.text)
            return TtsResponse(audio_base64=audio, mime_type=mime_type)

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {req.language}")


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    try:
        translation = await sarvam.translate(req.text, req.source_language)
    except Exception:
        logger.exception("Sarvam translate failed, falling back to OpenAI")
        translation = complete(
            system="Translate the following text to English. Return only the translation, no explanation.",
            messages=[{"role": "user", "content": req.text}],
        )
    return TranslateResponse(translation=translation)
