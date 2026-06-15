import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminId } from '@/lib/auth/requireAdmin';
import { generateGreeting } from '@/lib/aiService';
import type { FilmConfig, FilmIntelligencePack } from '@/lib/types';

export async function POST(req: NextRequest) {
  const adminId = getAdminId(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { filmSlug } = await req.json();
  if (!filmSlug) return NextResponse.json({ error: 'filmSlug is required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: film } = await supabase
    .from('film_configs')
    .select('*')
    .eq('slug', filmSlug)
    .eq('admin_id', adminId)
    .maybeSingle();

  if (!film) return NextResponse.json({ error: 'Film not found' }, { status: 404 });

  const { data: intelligence } = await supabase
    .from('film_intelligence')
    .select('pack')
    .eq('film_config_id', film.id)
    .maybeSingle();

  if (!intelligence) {
    return NextResponse.json({ error: 'Run synthesis before starting an interview' }, { status: 400 });
  }

  const pack = intelligence.pack as FilmIntelligencePack;

  let greeting;
  try {
    greeting = await generateGreeting(film as FilmConfig, pack);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Greeting generation failed' }, { status: 502 });
  }

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      film_config_id: film.id,
      admin_id: adminId,
      language: film.language,
      celebrity_name: film.celebrity_name,
      film_name: film.film_name,
      status: 'greeting',
      viewer_greeting: greeting.viewerGreeting,
      celebrity_greeting: greeting.celebrityGreeting,
      celebrity_greeting_translation: greeting.celebrityGreetingTranslation,
      current_turn: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessionId: session.id, greeting });
}
