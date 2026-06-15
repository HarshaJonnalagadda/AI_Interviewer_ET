import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { loadSessionContext } from '@/lib/interview/context';
import { textToSpeech } from '@/lib/aiService';

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const supabase = createServiceClient();
  const ctx = await loadSessionContext(supabase, sessionId);
  if (!ctx) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  const { session, film } = ctx;

  const { data: turn } = await supabase
    .from('session_turns')
    .select('*')
    .eq('session_id', sessionId)
    .eq('turn_number', session.current_turn)
    .maybeSingle();

  if (!turn) return NextResponse.json({ error: 'No active question' }, { status: 404 });

  let audio;
  try {
    audio = await textToSpeech(turn.question_text, film.language);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'TTS failed' }, { status: 502 });
  }

  return NextResponse.json({
    questionText: turn.question_text,
    audioBase64: audio.audioBase64,
    mimeType: audio.mimeType,
    turnNumber: turn.turn_number,
    questionCount: film.question_count,
    answered: !!turn.answer_transcript,
    answerTranscript: turn.answer_transcript,
    answerTranslation: turn.answer_translation,
  });
}
