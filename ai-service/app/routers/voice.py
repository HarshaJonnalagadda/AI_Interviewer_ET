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

router = APIRouter(dependencies=[Depends(require_api_key)])


@router.post("/stt", response_model=SttResponse)
async def stt(req: SttRequest) -> SttResponse:
    if req.language == "en":
        transcript = await whisper.speech_to_text(req.audio_base64)
    elif req.language in ("te", "hi"):
        transcript = await sarvam.speech_to_text(req.audio_base64, req.language)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {req.language}")
    return SttResponse(transcript=transcript)


@router.post("/tts", response_model=TtsResponse)
async def tts(req: TtsRequest) -> TtsResponse:
    if req.language == "en":
        audio = await elevenlabs.text_to_speech(req.text)
        mime_type = "audio/mpeg"
    elif req.language in ("te", "hi"):
        audio = await sarvam.text_to_speech(req.text, req.language)
        mime_type = "audio/wav"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {req.language}")
    return TtsResponse(audio_base64=audio, mime_type=mime_type)


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    translation = await sarvam.translate(req.text, req.source_language)
    return TranslateResponse(translation=translation)
