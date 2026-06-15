from fastapi import APIRouter, Depends

from app.auth import require_api_key
from app.prompts import synthesis_prompt
from app.schemas import FilmIntelligencePack, SynthesizeRequest, SynthesizeResponse
from app.services.claude import complete_json

router = APIRouter(dependencies=[Depends(require_api_key)])


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize(req: SynthesizeRequest) -> SynthesizeResponse:
    raw = complete_json(synthesis_prompt(req.film, req.sources), max_tokens=2000)
    pack = FilmIntelligencePack.model_validate(raw)
    return SynthesizeResponse(pack=pack)
