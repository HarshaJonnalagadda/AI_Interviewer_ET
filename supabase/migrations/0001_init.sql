-- StarCanvas initial schema
-- Run via: supabase db push  (or paste into the Supabase SQL editor)

-- ═══════════ AUTH ═══════════

CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE otp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════ FILM CONFIG ═══════════

CREATE TABLE film_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  slug TEXT UNIQUE NOT NULL,
  film_name TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('te','hi','en')),
  release_year TEXT,
  celebrity_name TEXT NOT NULL,
  celebrity_role TEXT NOT NULL,
  celebrity_pronoun TEXT DEFAULT 'they',
  question_count INTEGER DEFAULT 7,
  avoid_topics TEXT[] DEFAULT '{}',
  session_title TEXT,
  context_notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════ INGESTION ═══════════

CREATE TABLE ingestion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  film_config_id UUID REFERENCES film_configs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('poster','teaser','trailer','interview','song','hashtag','reference')),
  source_url TEXT,
  file_path TEXT,
  hashtags TEXT[],
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','failed')),
  result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE film_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  film_config_id UUID REFERENCES film_configs(id) ON DELETE CASCADE,
  pack JSONB NOT NULL,
  sources_processed INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(film_config_id)
);

-- ═══════════ SESSIONS ═══════════

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  film_config_id UUID REFERENCES film_configs(id),
  admin_id UUID REFERENCES admins(id),
  language TEXT NOT NULL CHECK (language IN ('te','hi','en')),
  celebrity_name TEXT NOT NULL,
  film_name TEXT NOT NULL,
  status TEXT DEFAULT 'greeting'
    CHECK (status IN ('greeting','active','paused','completed','poster_generated')),
  viewer_greeting TEXT,
  celebrity_greeting TEXT,
  celebrity_greeting_translation TEXT,
  current_turn INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE session_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_audio_url TEXT,
  answer_transcript TEXT,
  answer_translation TEXT,
  answer_audio_url TEXT,
  answer_duration_seconds FLOAT,
  claude_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  turn_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════ POSTERS ═══════════

CREATE TABLE poster_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  core_symbol TEXT NOT NULL,
  dominant_hex TEXT NOT NULL,
  emotional_tone TEXT,
  tagline TEXT,
  composition_hint TEXT,
  symbol_source TEXT,
  full_prompt TEXT,
  extracted_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE posters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  poster_elements_id UUID REFERENCES poster_elements(id),
  storage_url TEXT NOT NULL,
  pdf_url TEXT,
  variant_index INTEGER NOT NULL,
  generation_model TEXT DEFAULT 'ideogram-v3',
  selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════ INDEXES ═══════════

CREATE INDEX idx_queue_film_status ON ingestion_queue(film_config_id, status);
CREATE INDEX idx_queue_pending ON ingestion_queue(status) WHERE status = 'pending';
CREATE INDEX idx_turns_session ON session_turns(session_id, turn_number);
CREATE INDEX idx_messages_session ON session_messages(session_id, turn_number);
CREATE INDEX idx_sessions_admin ON sessions(admin_id, created_at DESC);
CREATE INDEX idx_sessions_film ON sessions(film_config_id);

-- ═══════════ STORAGE ═══════════
-- Create a public storage bucket for generated posters (run once):
-- insert into storage.buckets (id, name, public) values ('posters', 'posters', true);
