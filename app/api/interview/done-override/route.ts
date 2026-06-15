import { NextResponse } from 'next/server';

/**
 * Acknowledges an operator-triggered "Done" override. The actual recording
 * stop happens client-side (VoiceRecorder); this exists so the operator
 * action is captured for the route contract / future audit logging.
 */
export async function POST() {
  return NextResponse.json({ ok: true });
}
