import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { loadSessionContext } from '@/lib/interview/context';
import { generateNextQuestion, speechToText, textToSpeech, translateText } from '@/lib/aiService';

export async function POST(req: NextRequest) {
  const { sessionId, audioBase64, turnNumber, durationSeconds } = await req.json();
  if (!sessionId || !audioBase64 || !turnNumber) {
    return NextResponse.json({ error: 'sessionId, audioBase64 and turnNumber are required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const ctx = await loadSessionContext(supabase, sessionId);
  if (!ctx) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  const { session, film, pack } = ctx;

  // 1. Speech to text
  let transcript: string;
  try {
    transcript = await speechToText(audioBase64, film.language);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'STT failed' }, { status: 502 });
  }

  // 2. Translate to English (if needed and transcript is not already English)
  let translation = transcript;
  const isAlreadyEnglish = film.language !== 'en' && /^[\x00-\x7F\s.,!?'"()\-:;0-9]+$/.test(transcript.trim());
  if (film.language !== 'en' && !isAlreadyEnglish) {
    try {
      translation = await translateText(transcript, film.language as 'te' | 'hi');
    } catch (e) {
      translation = transcript; // show original if translation fails
    }
  }

  // 3. Store the answer on this turn
  await supabase
    .from('session_turns')
    .update({
      answer_transcript: transcript,
      answer_translation: translation,
      answer_duration_seconds: durationSeconds ?? null,
    })
    .eq('session_id', sessionId)
    .eq('turn_number', turnNumber);

  await supabase.from('session_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: transcript,
    turn_number: turnNumber,
  });

  // 4. Decide the next step
  const { data: messages } = await supabase
    .from('session_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  let result;
  try {
    result = await generateNextQuestion(film, pack, messages ?? []);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Question generation failed' }, { status: 502 });
  }

  const reachedLimit = turnNumber >= film.question_count;

  if (result.type === 'poster_ready' || reachedLimit) {
    const startedAt = session.started_at ? new Date(session.started_at).getTime() : Date.now();
    await supabase
      .from('sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_duration_seconds: Math.round((Date.now() - startedAt) / 1000),
      })
      .eq('id', sessionId);

    return NextResponse.json({ type: 'poster_ready', transcript, translation });
  }

  // 5. Generate + voice the next question
  let audio;
  try {
    audio = await textToSpeech(result.questionText, film.language);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'TTS failed' }, { status: 502 });
  }

  const nextTurn = turnNumber + 1;

  await supabase.from('session_turns').insert({
    session_id: sessionId,
    turn_number: nextTurn,
    question_text: result.questionText,
  });

  await supabase.from('session_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: result.questionText,
    turn_number: nextTurn,
  });

  await supabase.from('sessions').update({ current_turn: nextTurn }).eq('id', sessionId);

  return NextResponse.json({
    type: 'question',
    transcript,
    translation,
    questionText: result.questionText,
    audioBase64: audio.audioBase64,
    mimeType: audio.mimeType,
    turnNumber: nextTurn,
    questionCount: film.question_count,
  });
}
