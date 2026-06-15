import { NextRequest, NextResponse } from 'next/server';
import { speechToText } from '@/lib/aiService';
import type { Language } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { audioBase64, language } = await req.json();
  if (!audioBase64 || !language) {
    return NextResponse.json({ error: 'audioBase64 and language are required' }, { status: 400 });
  }

  try {
    const transcript = await speechToText(audioBase64, language as Language);
    return NextResponse.json({ transcript });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'STT failed' }, { status: 502 });
  }
}
