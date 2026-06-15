import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest, { params }: { params: { posterId: string } }) {
  const supabase = createServiceClient();

  const { data: poster } = await supabase.from('posters').select('session_id').eq('id', params.posterId).maybeSingle();
  if (!poster) return NextResponse.json({ error: 'Poster not found' }, { status: 404 });

  await supabase.from('posters').update({ selected: false }).eq('session_id', poster.session_id);

  const { error } = await supabase.from('posters').update({ selected: true }).eq('id', params.posterId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
