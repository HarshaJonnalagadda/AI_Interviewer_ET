import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminId } from '@/lib/auth/requireAdmin';

const LINK_SOURCE_TYPES = ['teaser', 'trailer', 'song', 'interview', 'reference'] as const;

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const adminId = await getAdminId(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: film, error } = await supabase
    .from('film_configs')
    .select('id')
    .eq('slug', params.slug)
    .eq('admin_id', adminId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!film) return NextResponse.json({ error: 'Film not found' }, { status: 404 });

  const { data: sources, error: sourcesError } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('film_config_id', film.id)
    .order('created_at', { ascending: true });

  if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 });
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const adminId = await getAdminId(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sourceType, sourceUrl } = await req.json();
  if (!LINK_SOURCE_TYPES.includes(sourceType)) {
    return NextResponse.json({ error: 'Invalid sourceType' }, { status: 400 });
  }
  if (!sourceUrl || typeof sourceUrl !== 'string') {
    return NextResponse.json({ error: 'sourceUrl is required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: film, error } = await supabase
    .from('film_configs')
    .select('id')
    .eq('slug', params.slug)
    .eq('admin_id', adminId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!film) return NextResponse.json({ error: 'Film not found' }, { status: 404 });

  const { data: source, error: insertError } = await supabase
    .from('ingestion_queue')
    .insert({
      film_config_id: film.id,
      source_type: sourceType,
      source_url: sourceUrl,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ source });
}
