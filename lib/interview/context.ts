import type { SupabaseClient } from '@supabase/supabase-js';
import type { FilmConfig, FilmIntelligencePack, InterviewSession, SessionTurn } from '@/lib/types';

export async function loadSessionContext(supabase: SupabaseClient, sessionId: string) {
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return null;

  const { data: film } = await supabase
    .from('film_configs')
    .select('*')
    .eq('id', session.film_config_id)
    .maybeSingle();

  if (!film) return null;

  const { data: intelligence } = await supabase
    .from('film_intelligence')
    .select('pack')
    .eq('film_config_id', film.id)
    .maybeSingle();

  if (!intelligence) return null;

  return {
    session: session as InterviewSession,
    film: film as FilmConfig,
    pack: intelligence.pack as FilmIntelligencePack,
  };
}

export function buildHistory(messages: { role: 'user' | 'assistant'; content: string }[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export function buildTranscript(turns: SessionTurn[]): string {
  return turns
    .map(
      (t) =>
        `Q${t.turn_number}: ${t.question_text}\nA${t.turn_number}: ${
          t.answer_translation || t.answer_transcript || '(no answer)'
        }`
    )
    .join('\n\n');
}
