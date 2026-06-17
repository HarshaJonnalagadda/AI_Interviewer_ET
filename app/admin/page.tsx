import Link from 'next/link';
import { getServerAdmin } from '@/lib/auth/serverAdmin';
import { createServiceClient } from '@/lib/supabase/service';
import LogoutButton from '../components/LogoutButton';
import SessionsPanel from '../components/SessionsPanel';

export default async function AdminDashboard() {
  const admin = await getServerAdmin();
  const supabase = createServiceClient();

  const { data: films } = await supabase
    .from('film_configs')
    .select('*, film_intelligence(id)')
    .eq('admin_id', admin?.adminId)
    .order('created_at', { ascending: false });

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, posters(storage_url, selected)')
    .eq('admin_id', admin?.adminId)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <div className="bot-name" style={{ fontSize: 18, marginBottom: 0 }}>sc·ai</div>
          <div className="bot-sub" style={{ marginBottom: 0 }}>Star Canvas · Admin</div>
        </div>
        <LogoutButton />
      </header>

      <div className="admin-columns">
        <section className="admin-col">
          <div className="admin-col-header">
            <h2>Film Configs</h2>
            <Link href="/admin/setup/new" className="login-btn admin-btn-inline">+ New Film</Link>
          </div>
          <div className="admin-list">
            {!films?.length && <div className="admin-empty">No films yet — create one to get started.</div>}
            {films?.map((film) => {
              const ready = Array.isArray(film.film_intelligence) ? film.film_intelligence.length > 0 : !!film.film_intelligence;
              return (
                <div key={film.id} className="admin-row">
                  <div>
                    <div className="admin-row-title">{film.film_name} {film.release_year ? `(${film.release_year})` : ''}</div>
                    <div className="admin-row-sub">{film.celebrity_name} · {film.language.toUpperCase()}</div>
                  </div>
                  <div className="admin-row-status">
                    {ready ? <span className="status-ok">✓ Pack Ready</span> : <span className="status-pending">✗ Not Started</span>}
                  </div>
                  <div className="admin-row-actions">
                    <Link href={`/admin/setup/${film.slug}`} className="admin-link">→ Setup</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="admin-col">
          <div className="admin-col-header">
            <h2>Recent Sessions</h2>
          </div>
          <SessionsPanel sessions={sessions ?? []} />
        </section>
      </div>
    </div>
  );
}
