import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { loadSessionContext, buildTranscript } from '@/lib/interview/context';
import { extractPosterElements, generatePosterImages } from '@/lib/aiService';

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const supabase = createServiceClient();
  const ctx = await loadSessionContext(supabase, sessionId);
  if (!ctx) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  const { film, pack } = ctx;

  const { data: turns } = await supabase
    .from('session_turns')
    .select('*')
    .eq('session_id', sessionId)
    .order('turn_number', { ascending: true });

  const transcript = buildTranscript(turns ?? []);

  // 1. Extract poster design elements from the transcript
  let extraction;
  try {
    extraction = await extractPosterElements(film, pack, transcript);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Element extraction failed' }, { status: 502 });
  }

  const { data: posterElements, error: elementsError } = await supabase
    .from('poster_elements')
    .insert({
      session_id: sessionId,
      core_symbol: extraction.coreSymbol,
      dominant_hex: extraction.dominantHex,
      emotional_tone: extraction.emotionalTone,
      tagline: extraction.tagline,
      composition_hint: extraction.compositionHint,
      symbol_source: extraction.symbolSource,
    })
    .select()
    .single();

  if (elementsError) return NextResponse.json({ error: elementsError.message }, { status: 500 });

  // 2. Generate poster image variants
  let generated;
  try {
    generated = await generatePosterImages(film.film_name, extraction, 3, film.director, film.lead_actors);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Image generation failed' }, { status: 502 });
  }

  await supabase
    .from('poster_elements')
    .update({ full_prompt: generated.prompt })
    .eq('id', posterElements.id);

  // 3. Upload each variant to storage and record it
  const posters = [];
  for (let i = 0; i < generated.variants.length; i++) {
    const variant = generated.variants[i];
    const ext = variant.mimeType.split('/')[1] || 'png';
    const path = `${sessionId}/variant-${i + 1}.${ext}`;
    const buffer = Buffer.from(variant.imageBase64, 'base64');

    const { error: uploadError } = await supabase.storage
      .from('posters')
      .upload(path, buffer, { contentType: variant.mimeType, upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicUrl } = supabase.storage.from('posters').getPublicUrl(path);

    const { data: poster, error: posterError } = await supabase
      .from('posters')
      .insert({
        session_id: sessionId,
        poster_elements_id: posterElements.id,
        storage_url: publicUrl.publicUrl,
        variant_index: i + 1,
      })
      .select()
      .single();

    if (posterError) return NextResponse.json({ error: posterError.message }, { status: 500 });
    posters.push(poster);
  }

  await supabase.from('sessions').update({ status: 'poster_generated' }).eq('id', sessionId);

  return NextResponse.json({ posterElements, posters });
}
