import type { FilmConfig, FilmIntelligencePack, Language, PosterExtraction } from './types';

const BASE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.AI_SERVICE_API_KEY ? { Authorization: `Bearer ${process.env.AI_SERVICE_API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI service ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

export function filmContext(film: FilmConfig) {
  return {
    filmName: film.film_name,
    language: film.language,
    releaseYear: film.release_year ?? undefined,
    celebrityName: film.celebrity_name,
    celebrityRole: film.celebrity_role,
    celebrityPronoun: film.celebrity_pronoun,
    avoidTopics: film.avoid_topics,
    contextNotes: film.context_notes ?? undefined,
  };
}

export async function synthesizePack(film: FilmConfig): Promise<FilmIntelligencePack> {
  const res = await call<{ pack: FilmIntelligencePack }>('/synthesize', { film: filmContext(film) });
  return res.pack;
}

export async function generateGreeting(film: FilmConfig, pack: FilmIntelligencePack) {
  return call<{
    viewerGreeting: string;
    celebrityGreeting: string;
    celebrityGreetingTranslation: string;
  }>('/greeting', { film: filmContext(film), pack });
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type QuestionResult =
  | { type: 'question'; questionText: string }
  | {
      type: 'poster_ready';
      posterReady: {
        coreSymbol: string;
        dominantHex: string;
        emotionalTone: string;
        tagline: string;
        compositionHint: PosterExtraction['compositionHint'];
      };
    };

export async function generateNextQuestion(
  film: FilmConfig,
  pack: FilmIntelligencePack,
  history: ChatMessage[]
): Promise<QuestionResult> {
  return call<QuestionResult>('/question', {
    film: filmContext(film),
    pack,
    history,
    questionCount: film.question_count,
  });
}

export async function speechToText(audioBase64: string, language: Language): Promise<string> {
  const res = await call<{ transcript: string }>('/stt', { audioBase64, language });
  return res.transcript;
}

export async function textToSpeech(text: string, language: Language): Promise<{ audioBase64: string; mimeType: string }> {
  return call('/tts', { text, language });
}

export async function translateText(text: string, sourceLanguage: 'te' | 'hi'): Promise<string> {
  const res = await call<{ translation: string }>('/translate', { text, sourceLanguage });
  return res.translation;
}

export async function extractPosterElements(
  film: FilmConfig,
  pack: FilmIntelligencePack,
  transcript: string
): Promise<PosterExtraction> {
  const res = await call<{ extraction: PosterExtraction }>('/poster/extract', {
    film: filmContext(film),
    pack,
    transcript,
  });
  return res.extraction;
}

export async function generatePosterImages(
  filmName: string,
  extraction: PosterExtraction,
  variants = 3
): Promise<{ variants: { imageBase64: string; mimeType: string }[]; prompt: string }> {
  return call('/poster/generate', { filmName, extraction, variants });
}
