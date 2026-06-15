import json

from app.schemas import FilmContext, FilmIntelligencePack, PosterExtraction, ProcessedSource

LANGUAGE_NAMES = {"te": "Telugu", "hi": "Hindi", "en": "English"}


def synthesis_prompt(film: FilmContext, sources: list[ProcessedSource] | None = None) -> str:
    """Builds a FilmIntelligencePack from manually-entered film context plus
    any processed sources (posters, YouTube transcripts, articles).

    Claude infers plausible visual motifs, palette, and an emotional arc from
    the notes and processed sources, and uses its own knowledge of the
    film/celebrity where helpful. Where it is inferring rather than working
    from a stated fact, confidence should be marked "low".
    """
    sources = sources or []

    if sources:
        processed_sources_section = "\n\n".join(
            f"SOURCE — {s.label}:\n{s.summary[:2000]}" for s in sources
        )
        sources_instructions = (
            "When a visual motif, dialogue highlight, or sentiment is grounded in one of the "
            "PROCESSED SOURCES above, set its \"sources\" / attribution to that source's label "
            "(e.g. \"Teaser: Movie Name\", \"Poster Image\", \"Article: Site Name\") and raise "
            "confidence accordingly (\"high\" or \"medium\"). Only use \"inferred\" or \"admin notes\" "
            "when nothing in the processed sources supports it."
        )
    else:
        processed_sources_section = "(none — no ingestion has been run yet)"
        sources_instructions = (
            "No processed sources are available — base everything on the admin notes below "
            "and your own knowledge of the film/celebrity. Where you are inferring rather than "
            "working from a stated fact, mark confidence as \"low\"."
        )

    total_sources = 1 + len(sources)

    return f"""
You are building a Film Intelligence Pack for an AI interview host.

FILM: {film.film_name} ({film.release_year or "unknown year"})
LANGUAGE: {LANGUAGE_NAMES.get(film.language, film.language)}
CELEBRITY: {film.celebrity_name} ({film.celebrity_role})
AVOID TOPICS: {", ".join(film.avoid_topics) or "none specified"}

ADMIN NOTES:
{film.context_notes or "(none provided)"}

PROCESSED SOURCES:
{processed_sources_section}

{sources_instructions}

Respond ONLY as valid JSON, no markdown, matching this exact shape:
{{
  "filmName": "{film.film_name}",
  "releaseYear": "{film.release_year or ''}",
  "visualMotifs": [
    {{"motif": "...", "confidence": "high|medium|low", "sources": ["admin notes" | "inferred"]}}
  ],
  "dominantColors": ["#XXXXXX", "..."],
  "emotionalArc": "one sentence describing the film's emotional journey",
  "dialogueHighlights": ["short memorable lines, or [] if none known"],
  "celebrity": {{
    "speakingStyle": "one sentence",
    "topicsThatLightUpAbout": ["topic", "..."],
    "topicsTheyDeflect": ["topic", "..."],
    "avoidList": {json.dumps(film.avoid_topics)}
  }},
  "fanSentiment": {{
    "excitement": ["..."],
    "confusion": ["..."]
  }},
  "contradictions": ["interesting tensions worth probing, or [] if none"],
  "operatorAvoidTopics": {json.dumps(film.avoid_topics)},
  "sourcesProcessed": {{"total": {total_sources}}}
}}

Note: the key in "celebrity" for things the celebrity lights up about must be
named "topicsTheyLightUpAbout" (not "topicsThatLightUpAbout") — use that exact
key name in your JSON output.
""".strip()


def greeting_prompt(film: FilmContext, pack: FilmIntelligencePack) -> str:
    language_name = LANGUAGE_NAMES.get(film.language, film.language)
    return f"""
Generate a greeting for a celebrity interview. Return JSON only:
{{
  "viewerGreeting": "3 sentences in English, cinematic, for the audience watching",
  "celebrityGreeting": "3 sentences in {language_name}, warm and personal, directly to {film.celebrity_name}",
  "celebrityGreetingTranslation": "English translation of the celebrity greeting"
}}

Context:
- Film: {film.film_name}
- Celebrity: {film.celebrity_name}, {film.celebrity_role}
- Language: {language_name}
- Film themes: {pack.emotional_arc}
""".strip()


def interview_system_prompt(film: FilmContext, pack: FilmIntelligencePack, question_count: int) -> str:
    language_name = LANGUAGE_NAMES.get(film.language, film.language)
    visual_motifs = "\n".join(
        f"- {m.motif} [{m.confidence}, from: {', '.join(m.sources)}]" for m in pack.visual_motifs
    )
    avoid = ", ".join({*pack.operator_avoid_topics, *pack.celebrity.avoid_list})

    return f"""
You are sc·ai, a warm and perceptive AI interviewer for the film "{pack.film_name}".

CELEBRITY: {film.celebrity_name} ({film.celebrity_role})
LANGUAGE: {language_name} — respond ONLY in this language (except the POSTER_READY JSON block, which is always English)
FILM: {pack.film_name} ({pack.release_year or "unknown year"})

FILM INTELLIGENCE (from {pack.sources_processed.total} source(s)):

VISUAL MOTIFS:
{visual_motifs or "- none identified yet"}

DOMINANT PALETTE: {", ".join(pack.dominant_colors)}
EMOTIONAL ARC: {pack.emotional_arc}
KEY DIALOGUE: {" | ".join(pack.dialogue_highlights) or "none"}

CELEBRITY PROFILE:
- Speaking style: {pack.celebrity.speaking_style}
- Lights up about: {", ".join(pack.celebrity.topics_they_light_up_about)}
- Deflects: {", ".join(pack.celebrity.topics_they_deflect)}

FAN SENTIMENT:
- Excited about: {"; ".join(pack.fan_sentiment.excitement)}
- Confused about: {"; ".join(pack.fan_sentiment.confusion)}

CONTRADICTIONS TO PROBE: {" | ".join(pack.contradictions) or "none"}
AVOID: {avoid or "none"}

QUESTION RULES:
1. Ask ONLY ONE question per turn. Never combine two questions.
2. Always reference specific film details — never generic questions.
3. Use a 4:1 ratio: 4 vulnerability/personality questions per 1 promo reference.
4. If the celebrity gives a deflecting short answer twice, pivot to an absurd/fun question.
5. Back-reference earlier answers when relevant ("You mentioned X earlier — ...").
6. Use {film.celebrity_name}'s name naturally within questions, not just at the start.
7. Plan for {question_count} questions total across this interview.
8. When you have coreSymbol + dominantHex + emotionalTone + tagline confirmed
   (usually after the symbol/color questions have been answered, or once you
   have asked {question_count} questions), respond with ONLY this — no other text:

POSTER_READY
{{"coreSymbol":"...","dominantHex":"#......","emotionalTone":"...","tagline":"...","compositionHint":"centered|bottom-third|silhouette|corner-anchor"}}

QUESTION SEQUENCE TO COVER (track which are done across the conversation):
- ABSURD/VIRAL: a specific prop/location from the film, clippable
- PERSONAL/RELATABLE (x2): humanize, matching the celebrity's speaking style
- CREDIBILITY BUILDER: reference specific known dialogue or film details
- FAN BRIDGE: address fan excitement or confusion
- SYMBOL EXTRACTOR (required): "one prop in a time capsule" style question
- COLOR/EMOTION (required): "what colour is this film's feeling" style question
- STEALTH PROMO: natural film title reinforcement

OUTPUT FORMAT FOR QUESTIONS: respond with ONLY the question text in {language_name},
nothing else — no labels, no quotes, no explanation.
""".strip()


def poster_extraction_prompt(film: FilmContext, pack: FilmIntelligencePack, transcript: str) -> str:
    high_confidence_motifs = ", ".join(m.motif for m in pack.visual_motifs if m.confidence == "high")
    return f"""
Based on this interview transcript, extract poster design elements.
The celebrity's own words take PRIORITY over pre-loaded motifs.

Film: {film.film_name}
Known motifs (fallback only): {high_confidence_motifs or "none"}
Known palette (fallback only): {", ".join(pack.dominant_colors)}

Transcript:
{transcript}

Respond ONLY as valid JSON, no markdown:
{{
  "coreSymbol": "one concrete visually renderable object — the single prop the celebrity returned to most",
  "dominantHex": "#XXXXXX — color of the film's emotional register",
  "emotionalTone": "two words maximum",
  "tagline": "under 8 words, evocative not promotional",
  "compositionHint": "centered | bottom-third | silhouette | corner-anchor",
  "symbolSource": "celebrity-said | pre-loaded"
}}
""".strip()


def poster_image_prompt(film_name: str, extraction: PosterExtraction) -> str:
    return f"""
Minimalist movie poster. Saul Bass inspired. Flat graphic design.
No photorealism. No people. No faces. No text other than specified.

Central element: {extraction.core_symbol}, {extraction.composition_hint}.
Background: solid color wash {extraction.dominant_hex}, subtle gradient light to dark top to bottom.
Film title "{film_name}" in bold geometric sans-serif at bottom, large, legible, high contrast against background.
Tagline "{extraction.tagline}" in small caps above central element, understated.
Negative space is dominant. The object floats in silence.
Aspect ratio 2:3 portrait. High contrast edges. No clutter. No textures. No gradients on the object.
""".strip()


def poster_vision_prompt(film: FilmContext) -> str:
    return f"""
This image is a movie poster for "{film.film_name}" ({film.release_year or "unknown year"}),
starring {film.celebrity_name} ({film.celebrity_role}).

Describe it in a short paragraph (4-6 sentences) covering:
- The dominant colors (name them and give hex codes where you can estimate)
- The central visual motifs, symbols, or props shown
- The overall mood/tone the poster conveys
- Any text, tagline, or typography style visible

Write plain prose, no markdown, no JSON — this description will be fed directly
into another prompt as a source summary.
""".strip()
