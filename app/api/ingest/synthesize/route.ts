import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminId } from '@/lib/auth/requireAdmin';
import { synthesizePack } from '@/lib/aiService';
import type { FilmConfig } from '@/lib/types';

export async function POST(req: NextRequest) {
  const adminId = await getAdminId(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: film, error } = await supabase
    .from('film_configs')
    .select('*')
    .eq('slug', slug)
    .eq('admin_id', adminId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!film) return NextResponse.json({ error: 'Film not found' }, { status: 404 });

  let pack;
  try {
    pack = await synthesizePack(film as FilmConfig);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Synthesis failed' },
      { status: 502 }
    );
  }

  const { data: intelligence, error: upsertError } = await supabase
    .from('film_intelligence')
    .upsert(
      { film_config_id: film.id, pack, sources_processed: pack.sourcesProcessed?.total ?? 1 },
      { onConflict: 'film_config_id' }
    )
    .select()
    .single();

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  return NextResponse.json({ intelligence });
}
