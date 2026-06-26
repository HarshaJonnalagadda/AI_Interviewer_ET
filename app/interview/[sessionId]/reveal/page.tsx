import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import RevealClient from './RevealClient';

export const dynamic = 'force-dynamic';

export default async function RevealPage({ params }: { params: { sessionId: string } }) {
  const supabase = createServiceClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('id, film_name, celebrity_name, status, film_config_id')
    .eq('id', params.sessionId)
    .maybeSingle();

  if (!session) notFound();

  const { data: filmConfig } = await supabase
    .from('film_configs')
    .select('slug')
    .eq('id', session.film_config_id)
    .maybeSingle();

  const { data: posterElements } = await supabase
    .from('poster_elements')
    .select('*')
    .eq('session_id', session.id)
    .order('extracted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: posters } = await supabase
    .from('posters')
    .select('*')
    .eq('session_id', session.id)
    .order('variant_index', { ascending: true });

  return (
    <RevealClient
      sessionId={session.id}
      filmName={session.film_name}
      filmSlug={filmConfig?.slug ?? ''}
      celebrityName={session.celebrity_name}
      initialPosterElements={posterElements ?? null}
      initialPosters={posters ?? []}
    />
  );
}
