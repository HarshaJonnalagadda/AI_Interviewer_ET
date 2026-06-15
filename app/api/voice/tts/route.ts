import { NextRequest, NextResponse } from 'next/server';
import { textToSpeech } from '@/lib/aiService';
import type { Language } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { text, language } = await req.json();
  if (!text || !language) {
    return NextResponse.json({ error: 'text and language are required' }, { status: 400 });
  }

  try {
    const result = await textToSpeech(text, language as Language);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'TTS failed' }, { status: 502 });
  }
}
