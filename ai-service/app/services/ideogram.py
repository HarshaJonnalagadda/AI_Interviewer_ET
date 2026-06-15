import asyncio
import base64

import httpx

from app.config import get_settings

IDEOGRAM_GENERATE_URL = "https://api.ideogram.ai/v1/ideogram-v3/generate"


async def _generate_one(client: httpx.AsyncClient, prompt: str, api_key: str) -> str:
    res = await client.post(
        IDEOGRAM_GENERATE_URL,
        headers={"Api-Key": api_key},
        data={
            "prompt": prompt,
            "aspect_ratio": "2x3",
            "rendering_speed": "DEFAULT",
            "num_images": "1",
        },
    )
    res.raise_for_status()
    data = res.json()
    image_url = data["data"][0]["url"]

    image_res = await client.get(image_url)
    image_res.raise_for_status()
    return base64.b64encode(image_res.content).decode("utf-8")


async def generate_images(prompt: str, count: int) -> list[str]:
    """Generates `count` poster images and returns each as a base64-encoded JPEG/PNG."""
    api_key = get_settings().ideogram_api_key
    async with httpx.AsyncClient(timeout=120) as client:
        results = await asyncio.gather(*(_generate_one(client, prompt, api_key) for _ in range(count)))
    return list(results)
