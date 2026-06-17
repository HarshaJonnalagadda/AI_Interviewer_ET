-- Separate movie release language from interview language
ALTER TABLE film_configs
  ADD COLUMN IF NOT EXISTS movie_language TEXT;
