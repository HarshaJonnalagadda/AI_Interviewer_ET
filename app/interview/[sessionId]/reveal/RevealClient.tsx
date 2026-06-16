'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BotScene from '@/app/components/BotScene';
import type { Poster, PosterElements } from '@/lib/types';

interface Props {
  sessionId: string;
  filmName: string;
  filmSlug: string;
  celebrityName: string;
  initialPosterElements: PosterElements | null;
  initialPosters: Poster[];
}

type Phase = 'generating' | 'ready' | 'error';

export default function RevealClient({ sessionId, filmName, filmSlug, celebrityName, initialPosterElements, initialPosters }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(initialPosters.length > 0 ? 'ready' : 'generating');
  const [posters, setPosters] = useState<Poster[]>(initialPosters);
  const [posterElements, setPosterElements] = useState<PosterElements | null>(initialPosterElements);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  // Play thank-you + please-wait speech when the generating phase mounts
  useEffect(() => {
    if (initialPosters.length > 0) return;
    (async () => {
      try {
        const res = await fetch('/api/interview/thanks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const audio = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
        audio.play().catch(() => {});
      } catch { /* skip */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = useCallback(async () => {
    setPhase('generating');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/poster/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Poster generation failed');

      setPosterElements(data.posterElements);
      setPosters(data.posters);
      setPhase('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Poster generation failed');
      setPhase('error');
    }
  }, [sessionId]);

  useEffect(() => {
    if (initialPosters.length === 0) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSelect = (posterId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(posterId)) next.delete(posterId);
      else next.add(posterId);
      return next;
    });
  };

  const downloadSelected = useCallback(async () => {
    setDownloading(true);
    try {
      const selected = posters.filter((p) => selectedIds.has(p.id));
      for (const poster of selected) {
        const res = await fetch(poster.storage_url);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filmName.replace(/\s+/g, '-')}-poster-${poster.variant_index}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
      router.push('/admin');
    }
  }, [posters, selectedIds, filmName, router]);

  if (phase === 'generating') {
    return (
      <BotScene
        state="reveal"
        questionLabel={`${filmName} · ${celebrityName}`}
        questionText={`Thank you, ${celebrityName}! ✦ Your personalized poster is being crafted — please wait a moment...`}
        statusText="✦ Generating your poster"
        footerRight={filmName}
      />
    );
  }

  if (phase === 'error') {
    return (
      <BotScene state="idle" questionLabel={`${filmName} · ${celebrityName}`} questionText={errorMsg || 'Something went wrong.'} footerRight={filmName}>
        <button type="button" className="interview-btn" onClick={generate}>Retry</button>
      </BotScene>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="reveal-wrap">
      <div className="reveal-header">
        <div className="bot-name">sc·ai</div>
        <div className="bot-sub">Your poster · {filmName}</div>
        {posterElements?.tagline && <p className="reveal-tagline">&ldquo;{posterElements.tagline}&rdquo;</p>}
        <p className="reveal-hint">Tap a poster to select · select multiple to download</p>
      </div>

      <div className="reveal-grid">
        {posters.map((poster) => (
          <div
            key={poster.id}
            className={`reveal-card ${selectedIds.has(poster.id) ? 'reveal-selected' : ''}`}
            onClick={() => toggleSelect(poster.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster.storage_url}
              alt={`${filmName} poster variant ${poster.variant_index}`}
              className="reveal-img"
            />
            <div className="reveal-select-indicator">
              {selectedIds.has(poster.id) ? '✓ Selected' : 'Tap to select'}
            </div>
          </div>
        ))}
      </div>

      {errorMsg && <p className="reveal-error">{errorMsg}</p>}

      <div className="reveal-actions">
        {selectedCount > 0 && (
          <button
            type="button"
            className="reveal-download-btn"
            onClick={downloadSelected}
            disabled={downloading}
          >
            {downloading
              ? 'Downloading…'
              : selectedCount > 1
              ? `Download ${selectedCount} Posters`
              : 'Download Poster'}
          </button>
        )}
        {filmSlug && (
          <button
            type="button"
            className="interview-btn"
            onClick={() => router.push(`/admin/setup/${filmSlug}`)}
          >
            New Interview
          </button>
        )}
        <button
          type="button"
          className="reveal-view-btn"
          onClick={() => router.push('/admin')}
        >
          Back to Admin
        </button>
      </div>
    </div>
  );
}
