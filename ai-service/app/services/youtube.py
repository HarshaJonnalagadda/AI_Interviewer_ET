import logging
import re

import httpx
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable

logger = logging.getLogger(__name__)

_VIDEO_ID_PATTERNS = [
    re.compile(r"(?:v=|/shorts/|/embed/|youtu\.be/)([A-Za-z0-9_-]{11})"),
]


def extract_video_id(url: str) -> str | None:
    for pattern in _VIDEO_ID_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)
    return None


async def fetch_oembed_title(video_id: str) -> str | None:
    url = "https://www.youtube.com/oembed"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params={"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"})
            resp.raise_for_status()
            return resp.json().get("title")
    except Exception:
        logger.exception("Failed to fetch oEmbed title for %s", video_id)
        return None


def fetch_transcript(video_id: str) -> str | None:
    """Best-effort transcript fetch. Returns None if unavailable (cloud IPs are
    sometimes blocked by YouTube), so callers must degrade to title-only."""
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
    except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable, Exception):
        logger.exception("Failed to list transcripts for %s", video_id)
        return None

    for lang in ("en", "te", "hi"):
        try:
            transcript = transcript_list.find_transcript([lang])
            entries = transcript.fetch()
            return " ".join(e["text"] for e in entries)
        except Exception:
            continue

    try:
        transcript = next(iter(transcript_list))
        entries = transcript.fetch()
        return " ".join(e["text"] for e in entries)
    except Exception:
        logger.exception("Failed to fetch any transcript for %s", video_id)
        return None
