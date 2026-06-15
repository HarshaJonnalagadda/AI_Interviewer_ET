import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const supabase = createServiceClient();

  const { data: posterElements } = await supabase
    .from('poster_elements')
    .select('*')
    .eq('session_id', params.sessionId)
    .order('extracted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: posters, error } = await supabase
    .from('posters')
    .select('*')
    .eq('session_id', params.sessionId)
    .order('variant_index', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posterElements, posters: posters ?? [] });
}
