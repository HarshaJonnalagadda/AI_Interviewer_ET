import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminId } from '@/lib/auth/requireAdmin';
import { slugify } from '@/lib/slug';

export const dynamic = 'force-dynamic';

export async function GET() {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('film_configs')
    .select('*, film_intelligence(id)')
    .eq('admin_id', adminId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ films: data });
}

export async function POST(req: NextRequest) {
  const adminId = await getAdminId();
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
    director,
    leadActors,
    movieLanguage,
  } = body;

  if (!filmName || !language || !celebrityName || !celebrityRole) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const baseSlug = slugify(filmName);
  const supabase = createServiceClient();

  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const { data: existing } = await supabase.from('film_configs').select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${++suffix}`;
  }

  const { data, error } = await supabase
    .from('film_configs')
    .insert({
      admin_id: adminId,
      slug,
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
      director: director || null,
      lead_actors: leadActors || [],
      movie_language: movieLanguage || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ film: data });
}
