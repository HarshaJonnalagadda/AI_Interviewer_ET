import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerAdmin } from '@/lib/auth/serverAdmin';
import { createServiceClient } from '@/lib/supabase/service';

const LANGUAGE_LABELS: Record<string, string> = { te: 'Telugu', hi: 'Hindi', en: 'English' };

export default async function AdminSessionPage({ params }: { params: { id: string } }) {
  const admin = getServerAdmin();
  const supabase = createServiceClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', params.id)
    .eq('admin_id', admin?.adminId)
    .maybeSingle();

  if (!session) notFound();

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

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <div className="bot-name" style={{ fontSize: 18, marginBottom: 0 }}>sc·ai</div>
          <div className="bot-sub" style={{ marginBottom: 0 }}>Session Archive</div>
        </div>
        <Link href="/admin" className="admin-link">← Dashboard</Link>
      </header>

      <section className="admin-panel">
        <div className="admin-row-title">{session.film_name} — {session.celebrity_name}</div>
        <div className="admin-row-sub session-meta">
          {LANGUAGE_LABELS[session.language] ?? session.language} · {session.status}
          {session.started_at && <> · started {new Date(session.started_at).toLocaleString()}</>}
          {session.total_duration_seconds != null && <> · {Math.round(session.total_duration_seconds / 60)} min</>}
        </div>
        {(session.status === 'active' || session.status === 'paused' || session.status === 'greeting') && (
          <div className="admin-panel-actions">
            <Link href={`/interview/${session.id}`} className="admin-link">▶ Resume Interview</Link>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-col-header">
          <h2>Transcript</h2>
        </div>
        {!turns?.length && <div className="admin-empty">No turns recorded yet.</div>}
        <div className="transcript-list">
          {turns?.map((turn) => (
            <div key={turn.id} className="transcript-turn">
              <div className="transcript-q">Q{turn.turn_number}: {turn.question_text}</div>
              {turn.answer_transcript ? (
                <>
                  <div className="transcript-a">{turn.answer_transcript}</div>
                  {turn.answer_translation && (
                    <div className="transcript-a-translation">{turn.answer_translation}</div>
                  )}
                </>
              ) : (
                <div className="transcript-a transcript-a-empty">(no answer recorded)</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-col-header">
          <h2>Posters</h2>
        </div>
        {!posters?.length && <div className="admin-empty">No posters generated yet.</div>}
        {!!posters?.length && (
          <>
            {posters[0]?.poster_elements?.tagline && (
              <p className="reveal-tagline">&ldquo;{posters[0].poster_elements.tagline}&rdquo;</p>
            )}
            <div className="reveal-grid">
              {posters.map((poster) => (
                <div key={poster.id} className={`reveal-card ${poster.selected ? 'reveal-selected' : ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={poster.storage_url} alt={`Poster variant ${poster.variant_index}`} className="reveal-img" />
                  {poster.selected && <div className="reveal-select-btn">✓ Selected</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
