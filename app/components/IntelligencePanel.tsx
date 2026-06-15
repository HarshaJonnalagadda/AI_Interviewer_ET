'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FilmIntelligencePack } from '@/lib/types';

interface IntelligencePanelProps {
  slug: string;
  pack: FilmIntelligencePack | null;
}

export default function IntelligencePanel({ slug, pack }: IntelligencePanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSynthesis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ingest/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Synthesis failed');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const startInterview = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start interview');
      router.push(`/interview/${data.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStarting(false);
    }
  };

  return (
    <div className="admin-panel">
      <h2>Intelligence Pack {pack ? <span className="status-ok">✓ Ready</span> : <span className="status-pending">✗ Not Started</span>}</h2>

      {pack && (
        <div className="pack-view">
          <div className="pack-section">
            <div className="pack-label">Visual Motifs</div>
            {pack.visualMotifs.map((m, i) => (
              <div key={i} className="pack-motif">
                ● {m.motif} <span className="pack-confidence">[{m.confidence.toUpperCase()} — {m.sources.join(', ')}]</span>
              </div>
            ))}
          </div>

          <div className="pack-section">
            <div className="pack-label">Dominant Palette</div>
            <div className="pack-swatches">
              {pack.dominantColors.map((c, i) => (
                <span key={i} className="pack-swatch" style={{ background: c }} title={c} />
              ))}
            </div>
          </div>

          <div className="pack-section">
            <div className="pack-label">Emotional Arc</div>
            <div>{pack.emotionalArc}</div>
          </div>

          <div className="pack-section">
            <div className="pack-label">Celebrity: {pack.celebrity.speakingStyle}</div>
            <div>Lights up about: {pack.celebrity.topicsTheyLightUpAbout.join(', ') || '—'}</div>
            <div>Deflects: {pack.celebrity.topicsTheyDeflect.join(', ') || '—'}</div>
          </div>

          <div className="pack-section">
            <div className="pack-label">Fan Sentiment</div>
            <div>Excited: {pack.fanSentiment.excitement.join('; ') || '—'}</div>
            <div>Confused: {pack.fanSentiment.confusion.join('; ') || '—'}</div>
          </div>

          {pack.contradictions.length > 0 && (
            <div className="pack-section pack-warning">
              ⚠ {pack.contradictions.join(' | ')}
            </div>
          )}
        </div>
      )}

      {error && <div className="login-error">{error}</div>}

      <div className="admin-panel-actions">
        <button className="login-btn" onClick={runSynthesis} disabled={loading}>
          {loading ? 'Synthesizing…' : pack ? 'Re-run Synthesis' : 'Run Synthesis'}
        </button>
        {pack && (
          <button className="login-btn admin-btn-start" onClick={startInterview} disabled={starting}>
            {starting ? 'Starting…' : '▶ Start Interview'}
          </button>
        )}
      </div>
    </div>
  );
}
