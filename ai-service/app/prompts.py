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
MOVIE LANGUAGE: {film.movie_language or LANGUAGE_NAMES.get(film.language, film.language)}
INTERVIEW LANGUAGE: {LANGUAGE_NAMES.get(film.language, film.language)}
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

LANGUAGE NOTE: Write questions in {language_name}. Keep proper nouns, film titles, brand names, and English words in English (Latin) script — do not transliterate them into {language_name} script.

QUESTION RULES:
1. Ask ONLY ONE question per turn. Never combine two questions.
2. Derive questions from the celebrity's actual profile and fan sentiment above — not generic interview templates.
3. Focus on personal journey, emotions, and experiences — not props or objects.
4. If the celebrity gives a deflecting short answer twice, pivot to a lighter personal anecdote question.
5. Back-reference earlier answers when relevant ("You mentioned X earlier — ...").
6. Use {film.celebrity_name}'s name naturally within questions, not just at the start.
7. Plan for {question_count} questions total across this interview.
8. When you have coreSymbol + dominantHex + emotionalTone + tagline confirmed
   (after the emotion and legacy questions have been answered, or once you
   have asked {question_count} questions), respond with ONLY this — no other text:

POSTER_READY
{{"coreSymbol":"...","dominantHex":"#......","emotionalTone":"...","tagline":"...","compositionHint":"centered|bottom-third|silhouette|corner-anchor"}}

QUESTION FLOW (derive from the pack data above, cover in this order):
1. OPENING: Draw from their speaking style and topics they light up about — warm and personal, about their journey with this film.
2. PERSONAL DEPTH (x2): Inner experience — what surprised them, what challenged them, what they're most proud of. Reference specific fan excitement or contradiction points.
3. FAN BRIDGE: Pick one fan excitement or confusion point from the pack and surface it — make the celebrity feel the audience's energy.
4. PROCESS/CRAFT: How they prepared or what they personally brought to this role that no one else could have.
5. EMOTION (required): Ask what single emotion or feeling defines the entire film for them — surfaces emotionalTone + dominantHex.
6. LEGACY (required): Ask what moment, image, or memory from this film they'd carry forever — surfaces coreSymbol + tagline.

OUTPUT FORMAT FOR QUESTIONS: respond with ONLY the question text in {language_name},
nothing else — no labels, no quotes, no explanation.
""".strip()


def poster_extraction_prompt(film: FilmContext, pack: FilmIntelligencePack, transcript: str) -> str:
    high_confidence_motifs = ", ".join(m.motif for m in pack.visual_motifs if m.confidence == "high")
    cast_count = len(film.lead_actors) if film.lead_actors else 1
    cast_line = (
        f"Lead cast ({cast_count} people): {', '.join(film.lead_actors)}"
        if film.lead_actors else
        f"Celebrity: {film.celebrity_name}"
    )

    return f"""
You are designing a minimalist Indian film poster in the tradition of Andhadhun, Dil Se, OK Kanmani, and Piku.
Your task: extract the SINGLE visual metaphor object that carries the entire soul of this film.

Film: {film.film_name}
{cast_line}
Known motifs (use only if transcript gives nothing better): {high_confidence_motifs or "none"}
Known palette: {", ".join(pack.dominant_colors)}

Interview transcript:
{transcript}

SYMBOL DESIGN RULES:
1. The celebrity's own words about this film take absolute priority.
2. The coreSymbol must be ONE concrete object — drawable as a flat vector illustration.
3. The symbol must work on TWO levels: (a) what it literally is, (b) what it secretly means about the film.
4. CHARACTER COUNT RULE: If there are {cast_count} main characters, encode that count in the symbol cleverly.
   Examples: 3-person love story → object naturally occurring in threes, or a familiar object cracked/split into 3;
   2-person romance → two fish in a bowl, two straws in one glass; single protagonist → one iconic object.
   A "broken heart" split into {cast_count} is valid ONLY if {cast_count} == 2 and the film is specifically about heartbreak.
   Prefer SURPRISING SPECIFICITY: "3 cocktail glasses, two touching and one tipped away" beats "a broken heart".
5. The object must be simple enough to render as flat illustration — no complex scenes.
6. Tagline should ideally carry a double meaning or pun tied to the film's theme.

Respond ONLY as valid JSON, no markdown:
{{
  "coreSymbol": "precise object description — include structural details that encode character count or central tension (e.g. 'three cocktail glasses arranged in a triangle, the center one half-empty' not just 'a cocktail glass')",
  "dominantHex": "#XXXXXX — the film's emotional color",
  "emotionalTone": "two words maximum",
  "tagline": "under 8 words — conceptual, earns its presence through double meaning",
  "compositionHint": "centered | bottom-third | silhouette | corner-anchor",
  "symbolSource": "celebrity-said | pre-loaded"
}}
""".strip()


def poster_image_prompt(
    film_name: str,
    extraction: PosterExtraction,
    director: str | None = None,
    lead_actors: list[str] | None = None,
) -> str:
    actors_str = "   ·   ".join(a.upper() for a in lead_actors) if lead_actors else ""
    lead_line = (
        f'Top of poster, centered: "{actors_str}" in very small ALL-CAPS letter-spaced type, high contrast.\n'
        if actors_str else ""
    )
    director_line = (
        f'Directly below the film title: "DIRECTED BY {director.upper()}" in very small caps, same high-contrast color.\n'
        if director else ""
    )

    return f"""
Indian minimalist film poster. Flat vector illustration. NOT photorealism.

STYLE: The poster tradition of Andhadhun (glasses with piano-key lenses), Dil Se (train seen from above), OK Kanmani (goldfish bowl), Piku (car with commode on roof). Single clever metaphor object. Everything else is negative space.

BACKGROUND: Flat solid {extraction.dominant_hex}. Subtle paper/grain noise texture at 3% opacity for analog warmth. No gradient wash.

CENTRAL OBJECT — {extraction.core_symbol}.
Placement: {extraction.composition_hint}. Occupies approximately 55% of canvas height.
Render as clean flat illustration with precise edges and high contrast against the background.
If human figures are needed to convey scale or relationship: render them as small black silhouettes only — no faces, no detail, pure shape.
Object must be immediately recognizable as a flat graphic icon. No painterly strokes. No shadows except flat cast shadow if essential.

TEXT — render exactly these, no other text at all:
{lead_line}Tagline "{extraction.tagline}" — small italic caps, centered, subtle — placed just above the central object.
Film title "{film_name}" — bold geometric sans-serif, large, dominant — lower third of poster, high contrast.
{director_line}
RULES: No studio logos. No review quotes. No paragraph text. The image does the talking.
Portrait 2:3 ratio. Museum-quality precision. Clean geometry. The "aha moment" is more important than decoration.
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
