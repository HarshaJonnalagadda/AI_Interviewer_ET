import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import require_api_key
from app.prompts import poster_vision_prompt
from app.schemas import IngestRequest, IngestResponse
from app.services import youtube
from app.services.article import fetch_article
from app.services.claude import complete_with_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", dependencies=[Depends(require_api_key)])

_YOUTUBE_LABELS = {
    "teaser": "Teaser",
    "trailer": "Trailer",
    "song": "Song",
    "interview": "Interview",
}


@router.post("/process", response_model=IngestResponse)
async def process(req: IngestRequest) -> IngestResponse:
    if req.source_type in _YOUTUBE_LABELS:
        return await _process_youtube(req)
    if req.source_type == "reference":
        return await _process_reference(req)
    if req.source_type == "poster":
        return _process_poster(req)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported source type: {req.source_type}")


async def _process_youtube(req: IngestRequest) -> IngestResponse:
    if not req.source_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sourceUrl is required")

    video_id = youtube.extract_video_id(req.source_url)
    if not video_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not parse YouTube video ID from URL")

    title = await youtube.fetch_oembed_title(video_id) or req.source_url
    transcript = youtube.fetch_transcript(video_id)

    label = f"{_YOUTUBE_LABELS[req.source_type]}: {title}"
    summary = transcript[:4000] if transcript else f"(no transcript available — title only: {title})"
    return IngestResponse(label=label, summary=summary)


async def _process_reference(req: IngestRequest) -> IngestResponse:
    if not req.source_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sourceUrl is required")

    title, text = await fetch_article(req.source_url)
    label = f"Article: {title or req.source_url}"
    summary = text or f"(could not extract article text from {req.source_url})"
    return IngestResponse(label=label, summary=summary)


def _process_poster(req: IngestRequest) -> IngestResponse:
    if not req.image_base64 or not req.image_media_type:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="imageBase64 and imageMediaType are required")

    summary = complete_with_image(poster_vision_prompt(req.film), req.image_base64, req.image_media_type, max_tokens=500)
    return IngestResponse(label="Poster Image", summary=summary)
