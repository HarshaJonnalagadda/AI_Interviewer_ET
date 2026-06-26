import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminId } from '@/lib/auth/requireAdmin';

export async function DELETE(req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  const adminId = await getAdminId();
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

  const { error: deleteError } = await supabase
    .from('ingestion_queue')
    .delete()
    .eq('id', params.id)
    .eq('film_config_id', film.id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
