import asyncio

import httpx

from app.config import get_settings

OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations"


async def _generate_one(client: httpx.AsyncClient, prompt: str, api_key: str) -> str:
    res = await client.post(
        OPENAI_IMAGES_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": "gpt-image-1",
            "prompt": prompt,
            "size": "1024x1536",
            "n": 1,
        },
    )
    res.raise_for_status()
    data = res.json()
    return data["data"][0]["b64_json"]


async def generate_images(prompt: str, count: int) -> list[str]:
    """Generates `count` poster images via OpenAI's image API, each as base64 PNG."""
    api_key = get_settings().openai_api_key
    async with httpx.AsyncClient(timeout=180) as client:
        results = await asyncio.gather(*(_generate_one(client, prompt, api_key) for _ in range(count)))
    return list(results)
