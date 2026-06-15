import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminId } from '@/lib/auth/requireAdmin';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const adminId = getAdminId(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', params.id)
    .eq('admin_id', adminId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: turns } = await supabase
    .from('session_turns')
    .select('*')
    .eq('session_id', session.id)
    .order('turn_number', { ascending: true });

  const { data: posters } = await supabase
    .from('posters')
    .select('*, poster_elements(*)')
    .eq('session_id', session.id)
    .order('variant_index', { ascending: true });

  return NextResponse.json({ session, turns, posters });
}
