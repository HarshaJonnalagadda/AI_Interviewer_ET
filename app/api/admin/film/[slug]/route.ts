import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminId } from '@/lib/auth/requireAdmin';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const adminId = await getAdminId(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: film, error } = await supabase
    .from('film_configs')
    .select('*')
    .eq('slug', params.slug)
    .eq('admin_id', adminId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!film) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: intelligence } = await supabase
    .from('film_intelligence')
    .select('*')
    .eq('film_config_id', film.id)
    .maybeSingle();

  return NextResponse.json({ film, intelligence });
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  const adminId = await getAdminId(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    filmName,
    language,
    releaseYear,
    celebrityName,
    celebrityRole,
    celebrityPronoun,
    questionCount,
    avoidTopics,
    sessionTitle,
    contextNotes,
  } = body;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('film_configs')
    .update({
      film_name: filmName,
      language,
      release_year: releaseYear || null,
      celebrity_name: celebrityName,
      celebrity_role: celebrityRole,
      celebrity_pronoun: celebrityPronoun || 'they',
      question_count: questionCount || 7,
      avoid_topics: avoidTopics || [],
      session_title: sessionTitle || null,
      context_notes: contextNotes || null,
    })
    .eq('slug', params.slug)
    .eq('admin_id', adminId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ film: data });
}
