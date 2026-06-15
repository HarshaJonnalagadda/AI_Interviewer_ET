import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { loadSessionContext } from '@/lib/interview/context';
import { generateNextQuestion, textToSpeech } from '@/lib/aiService';

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const supabase = createServiceClient();
  const ctx = await loadSessionContext(supabase, sessionId);
  if (!ctx) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  const { session, film, pack } = ctx;

  if (session.status !== 'greeting') {
    return NextResponse.json({ error: `Session is already ${session.status}` }, { status: 409 });
  }

  let result;
  try {
    result = await generateNextQuestion(film, pack, []);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Question generation failed' }, { status: 502 });
  }

  if (result.type !== 'question') {
    return NextResponse.json({ error: 'Unexpected poster-ready signal on first question' }, { status: 502 });
  }

  let audio;
  try {
    audio = await textToSpeech(result.questionText, film.language);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'TTS failed' }, { status: 502 });
  }

  await supabase.from('session_turns').insert({
    session_id: sessionId,
    turn_number: 1,
    question_text: result.questionText,
  });

  await supabase.from('session_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: result.questionText,
    turn_number: 1,
  });

  await supabase
    .from('sessions')
    .update({ status: 'active', started_at: new Date().toISOString(), current_turn: 1 })
    .eq('id', sessionId);

  return NextResponse.json({
    questionText: result.questionText,
    audioBase64: audio.audioBase64,
    mimeType: audio.mimeType,
    turnNumber: 1,
    questionCount: film.question_count,
  });
}
