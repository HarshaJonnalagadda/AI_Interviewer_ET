from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

Language = Literal["te", "hi", "en"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ───────────── Film Intelligence Pack ─────────────


class VisualMotif(CamelModel):
    motif: str
    confidence: Literal["high", "medium", "low"]
    sources: list[str]


class CelebrityProfile(CamelModel):
    speaking_style: str
    topics_they_light_up_about: list[str]
    topics_they_deflect: list[str]
    avoid_list: list[str]


class FanSentiment(CamelModel):
    excitement: list[str]
    confusion: list[str]


class SourcesProcessed(CamelModel):
    total: int


class FilmIntelligencePack(CamelModel):
    film_name: str
    release_year: str | None = None
    visual_motifs: list[VisualMotif]
    dominant_colors: list[str]
    emotional_arc: str
    dialogue_highlights: list[str]
    celebrity: CelebrityProfile
    fan_sentiment: FanSentiment
    contradictions: list[str]
    operator_avoid_topics: list[str]
    sources_processed: SourcesProcessed


class FilmContext(CamelModel):
    film_name: str
    language: Language
    release_year: str | None = None
    celebrity_name: str
    celebrity_role: str
    celebrity_pronoun: str = "they"
    avoid_topics: list[str] = []
    context_notes: str | None = None
    movie_language: str | None = None


class ProcessedSource(CamelModel):
    label: str
    summary: str


class SynthesizeRequest(CamelModel):
    film: FilmContext
    sources: list[ProcessedSource] = []


class SynthesizeResponse(CamelModel):
    pack: FilmIntelligencePack


# ───────────── Ingestion ─────────────


class IngestRequest(CamelModel):
    source_type: Literal["teaser", "trailer", "song", "interview", "reference", "poster"]
    source_url: str | None = None
    image_base64: str | None = None
    image_media_type: str | None = None
    film: FilmContext


class IngestResponse(CamelModel):
    label: str
    summary: str


# ───────────── Greeting ─────────────


class GreetingRequest(CamelModel):
    film: FilmContext
    pack: FilmIntelligencePack


class GreetingResponse(CamelModel):
    viewer_greeting: str
    celebrity_greeting: str
    celebrity_greeting_translation: str


# ───────────── Interview Question Generation ─────────────


class ChatMessage(CamelModel):
    role: Literal["user", "assistant"]
    content: str


class QuestionRequest(CamelModel):
    film: FilmContext
    pack: FilmIntelligencePack
    history: list[ChatMessage]
    question_count: int


class PosterReadySignal(CamelModel):
    core_symbol: str
    dominant_hex: str
    emotional_tone: str
    tagline: str
    composition_hint: Literal["centered", "bottom-third", "silhouette", "corner-anchor"]


class QuestionResponse(CamelModel):
    type: Literal["question", "poster_ready"]
    question_text: str | None = None
    poster_ready: PosterReadySignal | None = None


# ───────────── Voice ─────────────


class SttRequest(CamelModel):
    audio_base64: str
    language: Language


class SttResponse(CamelModel):
    transcript: str


class TtsRequest(CamelModel):
    text: str
    language: Language


class TtsResponse(CamelModel):
    audio_base64: str
    mime_type: str


class TranslateRequest(CamelModel):
    text: str
    source_language: Literal["te", "hi"]


class TranslateResponse(CamelModel):
    translation: str


# ───────────── Poster ─────────────


class PosterExtraction(CamelModel):
    core_symbol: str
    dominant_hex: str
    emotional_tone: str
    tagline: str
    composition_hint: Literal["centered", "bottom-third", "silhouette", "corner-anchor"]
    symbol_source: Literal["celebrity-said", "pre-loaded", "film-intel", "both"]
    cast_count_used: int | None = None


class PosterExtractRequest(CamelModel):
    film: FilmContext
    pack: FilmIntelligencePack
    transcript: str


class PosterExtractResponse(CamelModel):
    extraction: PosterExtraction


class PosterGenerateRequest(CamelModel):
    film_name: str
    extraction: PosterExtraction
    variants: int = 3
    director: str | None = None
    lead_actors: list[str] = []


class PosterVariant(CamelModel):
    image_base64: str
    mime_type: str


class PosterGenerateResponse(CamelModel):
    variants: list[PosterVariant]
    prompt: str
