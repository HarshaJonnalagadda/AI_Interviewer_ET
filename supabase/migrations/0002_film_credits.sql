-- Add director and lead_actors to film_configs for poster generation
ALTER TABLE film_configs
  ADD COLUMN IF NOT EXISTS director TEXT,
  ADD COLUMN IF NOT EXISTS lead_actors TEXT[] DEFAULT '{}';
