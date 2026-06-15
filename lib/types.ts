export type Language = 'te' | 'hi' | 'en';

export interface VisualMotif {
  motif: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
}

export interface FilmIntelligencePack {
  filmName: string;
  releaseYear?: string;
  visualMotifs: VisualMotif[];
  dominantColors: string[];
  emotionalArc: string;
  dialogueHighlights: string[];
  celebrity: {
    speakingStyle: string;
    topicsTheyLightUpAbout: string[];
    topicsTheyDeflect: string[];
    avoidList: string[];
  };
  fanSentiment: {
    excitement: string[];
    confusion: string[];
  };
  contradictions: string[];
  operatorAvoidTopics: string[];
  sourcesProcessed: { total: number };
}

export interface FilmConfig {
  id: string;
  admin_id: string | null;
  slug: string;
  film_name: string;
  language: Language;
  release_year: string | null;
  celebrity_name: string;
  celebrity_role: string;
  celebrity_pronoun: string;
  question_count: number;
  avoid_topics: string[];
  session_title: string | null;
  context_notes: string | null;
  active: boolean;
  created_at: string;
}

export type SessionStatus = 'greeting' | 'active' | 'paused' | 'completed' | 'poster_generated';

export interface InterviewSession {
  id: string;
  film_config_id: string;
  admin_id: string | null;
  language: Language;
  celebrity_name: string;
  film_name: string;
  status: SessionStatus;
  viewer_greeting: string | null;
  celebrity_greeting: string | null;
  celebrity_greeting_translation: string | null;
  current_turn: number;
  started_at: string | null;
  completed_at: string | null;
  total_duration_seconds: number | null;
  created_at: string;
}

export interface SessionTurn {
  id: string;
  session_id: string;
  turn_number: number;
  question_text: string;
  question_audio_url: string | null;
  answer_transcript: string | null;
  answer_translation: string | null;
  answer_audio_url: string | null;
  answer_duration_seconds: number | null;
  claude_analysis: Record<string, unknown> | null;
  created_at: string;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  turn_number: number | null;
  created_at: string;
}

export interface PosterElements {
  id: string;
  session_id: string;
  core_symbol: string;
  dominant_hex: string;
  emotional_tone: string | null;
  tagline: string | null;
  composition_hint: string | null;
  symbol_source: string | null;
  full_prompt: string | null;
  extracted_at: string;
}

export interface Poster {
  id: string;
  session_id: string;
  poster_elements_id: string;
  storage_url: string;
  pdf_url: string | null;
  variant_index: number;
  generation_model: string;
  selected: boolean;
  created_at: string;
}

export interface PosterExtraction {
  coreSymbol: string;
  dominantHex: string;
  emotionalTone: string;
  tagline: string;
  compositionHint: 'centered' | 'bottom-third' | 'silhouette' | 'corner-anchor';
  symbolSource: 'celebrity-said' | 'pre-loaded';
}

export type BotStateId = 'idle' | 'listen' | 'think' | 'speak' | 'reveal';
