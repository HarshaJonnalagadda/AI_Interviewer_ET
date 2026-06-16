import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { textToSpeech } from '@/lib/aiService';

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('celebrity_name, film_name')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const text = `Thank you, ${session.celebrity_name}! That was a wonderful conversation about ${session.film_name}. Your personalized poster is being created right now — please wait just a moment while the magic happens.`;

  try {
    const audio = await textToSpeech(text, 'en');
    return NextResponse.json({ text, audioBase64: audio.audioBase64, mimeType: audio.mimeType });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'TTS failed' }, { status: 502 });
  }
}
