import json
import logging
import re

import httpx
from anthropic import Anthropic, APIError

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: Anthropic | None = None

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-4o"


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=get_settings().anthropic_api_key)
    return _client


def _to_openai_messages(system: str | None, messages: list[dict]) -> list[dict]:
    openai_messages = []
    if system:
        openai_messages.append({"role": "system", "content": system})

    for m in messages:
        content = m["content"]
        if isinstance(content, str):
            openai_messages.append({"role": m["role"], "content": content})
            continue

        parts = []
        for block in content:
            if block["type"] == "text":
                parts.append({"type": "text", "text": block["text"]})
            elif block["type"] == "image":
                source = block["source"]
                parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{source['media_type']};base64,{source['data']}"},
                })
        openai_messages.append({"role": m["role"], "content": parts})

    return openai_messages


def _complete_openai(system: str | None, messages: list[dict], max_tokens: int) -> str:
    settings = get_settings()
    payload = {
        "model": OPENAI_MODEL,
        "max_tokens": max_tokens,
        "messages": _to_openai_messages(system, messages),
    }
    with httpx.Client(timeout=60) as client:
        res = client.post(
            OPENAI_CHAT_URL,
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json=payload,
        )
        res.raise_for_status()
        data = res.json()
    return data["choices"][0]["message"]["content"] or ""


def complete(system: str | None, messages: list[dict], max_tokens: int = 1024) -> str:
    """Sends a message to Claude and returns the concatenated text response.

    Falls back to OpenAI (if configured) when the Anthropic API errors out —
    e.g. low credit balance, rate limits, or outages.
    """
    settings = get_settings()
    kwargs: dict = {
        "model": settings.claude_model,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        kwargs["system"] = system

    try:
        response = get_client().messages.create(**kwargs)
        return "".join(block.text for block in response.content if block.type == "text")
    except APIError:
        if not settings.openai_api_key:
            raise
        logger.exception("Anthropic call failed, falling back to OpenAI")
        return _complete_openai(system, messages, max_tokens)


def complete_with_image(prompt: str, image_base64: str, media_type: str, max_tokens: int = 1024) -> str:
    """Sends a single-turn prompt with an attached image and returns the text response."""
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": image_base64},
                },
                {"type": "text", "text": prompt},
            ],
        }
    ]
    return complete(system=None, messages=messages, max_tokens=max_tokens)


def complete_json(prompt: str, max_tokens: int = 2000) -> dict:
    """Sends a single-turn prompt expecting a JSON object back.

    Tolerates markdown code fences and stray preamble/trailing text around
    the JSON object — models occasionally add a sentence before or after
    the object even when told not to.
    """
    text = complete(system=None, messages=[{"role": "user", "content": prompt}], max_tokens=max_tokens)
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        first = cleaned.find("{")
        last = cleaned.rfind("}")
        if first == -1 or last == -1 or last < first:
            logger.error("complete_json: no JSON object found in response: %r", text[:2000])
            raise
        try:
            return json.loads(cleaned[first : last + 1])
        except json.JSONDecodeError:
            logger.error("complete_json: failed to parse extracted JSON: %r", cleaned[first : last + 1][:2000])
            raise
