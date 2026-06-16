import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { textToSpeech } from '@/lib/aiService';

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('viewer_greeting')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session?.viewer_greeting) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  try {
    const audio = await textToSpeech(session.viewer_greeting, 'en');
    return NextResponse.json({ audioBase64: audio.audioBase64, mimeType: audio.mimeType });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'TTS failed' }, { status: 502 });
  }
}
