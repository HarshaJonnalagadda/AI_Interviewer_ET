import logging

import httpx
import trafilatura

logger = logging.getLogger(__name__)

MAX_ARTICLE_CHARS = 4000


async def fetch_article(url: str) -> tuple[str | None, str | None]:
    """Fetches a web page and extracts its title and main text. Returns
    (title, text), either of which may be None on failure."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; StarCanvasBot/1.0)"})
            resp.raise_for_status()
            html = resp.text
    except Exception:
        logger.exception("Failed to fetch article %s", url)
        return None, None

    text = trafilatura.extract(html, favor_recall=True)
    metadata = trafilatura.extract_metadata(html)
    title = metadata.title if metadata else None

    if text and len(text) > MAX_ARTICLE_CHARS:
        text = text[:MAX_ARTICLE_CHARS]

    return title, text
