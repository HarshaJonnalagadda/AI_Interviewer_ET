import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (session.status !== 'completed' && session.status !== 'poster_generated') {
    const startedAt = session.started_at ? new Date(session.started_at).getTime() : Date.now();
    await supabase
      .from('sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_duration_seconds: Math.round((Date.now() - startedAt) / 1000),
      })
      .eq('id', sessionId);
  }

  return NextResponse.json({ ok: true });
}
