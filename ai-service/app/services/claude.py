import json
import re

from anthropic import Anthropic

from app.config import get_settings

_client: Anthropic | None = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=get_settings().anthropic_api_key)
    return _client


def complete(system: str | None, messages: list[dict], max_tokens: int = 1024) -> str:
    """Sends a message to Claude and returns the concatenated text response."""
    settings = get_settings()
    kwargs: dict = {
        "model": settings.claude_model,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        kwargs["system"] = system

    response = get_client().messages.create(**kwargs)
    return "".join(block.text for block in response.content if block.type == "text")


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
    """Sends a single-turn prompt expecting a JSON object back, tolerating markdown fences."""
    text = complete(system=None, messages=[{"role": "user", "content": prompt}], max_tokens=max_tokens)
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return json.loads(cleaned)
