import { NextRequest, NextResponse } from 'next/server';
import { translateText } from '@/lib/aiService';

export async function POST(req: NextRequest) {
  const { text, sourceLanguage } = await req.json();
  if (!text || !sourceLanguage) {
    return NextResponse.json({ error: 'text and sourceLanguage are required' }, { status: 400 });
  }
  if (sourceLanguage !== 'te' && sourceLanguage !== 'hi') {
    return NextResponse.json({ error: 'sourceLanguage must be te or hi' }, { status: 400 });
  }

  try {
    const translation = await translateText(text, sourceLanguage);
    return NextResponse.json({ translation });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Translation failed' }, { status: 502 });
  }
}
