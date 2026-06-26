import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminId } from '@/lib/auth/requireAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('sessions')
    .select('*, posters(storage_url, selected)')
    .eq('admin_id', adminId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}
