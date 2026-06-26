import { notFound } from 'next/navigation';
import { getServerAdmin } from '@/lib/auth/serverAdmin';
import { createServiceClient } from '@/lib/supabase/service';
import FilmForm from '../../../components/FilmForm';
import IntelligencePanel from '../../../components/IntelligencePanel';
import SourcesPanel from '../../../components/SourcesPanel';
import type { FilmConfig, FilmIntelligencePack, IngestionSource } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function FilmSetupPage({ params }: { params: { slug: string } }) {
  const admin = await getServerAdmin();
  const supabase = createServiceClient();

  const { data: film } = await supabase
    .from('film_configs')
    .select('*')
    .eq('slug', params.slug)
    .eq('admin_id', admin?.adminId)
    .maybeSingle();

  if (!film) notFound();

  const { data: intelligence } = await supabase
    .from('film_intelligence')
    .select('pack')
    .eq('film_config_id', film.id)
    .maybeSingle();

  const { data: sources } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('film_config_id', film.id)
    .order('created_at', { ascending: true });

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <div className="bot-name" style={{ fontSize: 18, marginBottom: 0 }}>{film.film_name}</div>
          <div className="bot-sub" style={{ marginBottom: 0 }}>{film.celebrity_name} · {film.language.toUpperCase()}</div>
        </div>
      </header>

      <FilmForm mode="edit" initial={film as FilmConfig} />
      <SourcesPanel slug={film.slug} initialSources={(sources as IngestionSource[]) ?? []} />
      <IntelligencePanel slug={film.slug} pack={(intelligence?.pack as FilmIntelligencePack) ?? null} />
    </div>
  );
}
