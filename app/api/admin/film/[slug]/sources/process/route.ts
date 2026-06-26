import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminId } from '@/lib/auth/requireAdmin';
import { processSource } from '@/lib/aiService';
import type { FilmConfig, IngestionSource } from '@/lib/types';

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

function mimeFromUrl(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0] || '';
  return EXT_TO_MIME[ext] || 'image/jpeg';
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: film, error } = await supabase
    .from('film_configs')
    .select('*')
    .eq('slug', params.slug)
    .eq('admin_id', adminId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!film) return NextResponse.json({ error: 'Film not found' }, { status: 404 });

  const { data: sources, error: sourcesError } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('film_config_id', film.id)
    .in('status', ['pending', 'failed']);

  if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 });

  const updated: IngestionSource[] = [];

  for (const source of sources as IngestionSource[]) {
    await supabase.from('ingestion_queue').update({ status: 'processing' }).eq('id', source.id);

    try {
      let result: { label: string; summary: string };

      if (source.source_type === 'poster') {
        if (!source.file_path) throw new Error('Missing image for poster source');
        const imgRes = await fetch(source.file_path);
        if (!imgRes.ok) throw new Error(`Failed to fetch poster image (${imgRes.status})`);
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        const imageMediaType = imgRes.headers.get('content-type') || mimeFromUrl(source.file_path);
        result = await processSource(film as FilmConfig, {
          sourceType: 'poster',
          imageBase64: buffer.toString('base64'),
          imageMediaType,
        });
      } else {
        if (!source.source_url) throw new Error('Missing source URL');
        result = await processSource(film as FilmConfig, {
          sourceType: source.source_type,
          sourceUrl: source.source_url,
        });
      }

      const { data: row } = await supabase
        .from('ingestion_queue')
        .update({ status: 'done', result, error_message: null, processed_at: new Date().toISOString() })
        .eq('id', source.id)
        .select()
        .single();

      if (row) updated.push(row as IngestionSource);
    } catch (e) {
      const { data: row } = await supabase
        .from('ingestion_queue')
        .update({
          status: 'failed',
          error_message: e instanceof Error ? e.message : 'Processing failed',
          retry_count: (source.retry_count ?? 0) + 1,
          processed_at: new Date().toISOString(),
        })
        .eq('id', source.id)
        .select()
        .single();

      if (row) updated.push(row as IngestionSource);
    }
  }

  return NextResponse.json({ sources: updated });
}
