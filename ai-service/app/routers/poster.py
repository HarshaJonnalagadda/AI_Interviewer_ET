from fastapi import APIRouter, Depends

from app.auth import require_api_key
from app.prompts import poster_extraction_prompt, poster_image_prompt
from app.schemas import (
    PosterExtraction,
    PosterExtractRequest,
    PosterExtractResponse,
    PosterGenerateRequest,
    PosterGenerateResponse,
    PosterVariant,
)
from app.services.claude import complete_json
from app.services.ideogram import generate_images

router = APIRouter(dependencies=[Depends(require_api_key)])


@router.post("/poster/extract", response_model=PosterExtractResponse)
async def extract(req: PosterExtractRequest) -> PosterExtractResponse:
    raw = complete_json(poster_extraction_prompt(req.film, req.pack, req.transcript), max_tokens=500)
    return PosterExtractResponse(extraction=PosterExtraction.model_validate(raw))


@router.post("/poster/generate", response_model=PosterGenerateResponse)
async def generate(req: PosterGenerateRequest) -> PosterGenerateResponse:
    prompt = poster_image_prompt(req.film_name, req.extraction)
    images = await generate_images(prompt, req.variants)
    variants = [PosterVariant(image_base64=img, mime_type="image/png") for img in images]
    return PosterGenerateResponse(variants=variants, prompt=prompt)
