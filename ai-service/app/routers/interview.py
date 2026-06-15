import re

from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_api_key
from app.prompts import greeting_prompt, interview_system_prompt
from app.schemas import (
    GreetingRequest,
    GreetingResponse,
    PosterReadySignal,
    QuestionRequest,
    QuestionResponse,
)
from app.services.claude import complete, complete_json

router = APIRouter(dependencies=[Depends(require_api_key)])

POSTER_READY_RE = re.compile(r"POSTER_READY\s*(\{.*\})", re.DOTALL)


@router.post("/greeting", response_model=GreetingResponse)
async def greeting(req: GreetingRequest) -> GreetingResponse:
    raw = complete_json(greeting_prompt(req.film, req.pack), max_tokens=800)
    return GreetingResponse.model_validate(raw)


@router.post("/question", response_model=QuestionResponse)
async def question(req: QuestionRequest) -> QuestionResponse:
    system = interview_system_prompt(req.film, req.pack, req.question_count)
    messages = [{"role": m.role, "content": m.content} for m in req.history]
    if not messages:
        messages = [{"role": "user", "content": "Begin the interview with your first question."}]

    text = complete(system=system, messages=messages, max_tokens=600)

    match = POSTER_READY_RE.search(text)
    if match:
        import json

        try:
            data = json.loads(match.group(1))
            return QuestionResponse(type="poster_ready", poster_ready=PosterReadySignal.model_validate(data))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Could not parse POSTER_READY payload: {exc}") from exc

    return QuestionResponse(type="question", question_text=text.strip())
