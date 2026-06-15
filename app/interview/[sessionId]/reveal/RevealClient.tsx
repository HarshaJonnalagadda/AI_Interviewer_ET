'use client';

import { useCallback, useEffect, useState } from 'react';
import BotScene from '@/app/components/BotScene';
import type { Poster, PosterElements } from '@/lib/types';

interface Props {
  sessionId: string;
  filmName: string;
  celebrityName: string;
  initialPosterElements: PosterElements | null;
  initialPosters: Poster[];
}

type Phase = 'generating' | 'ready' | 'error';

export default function RevealClient({ sessionId, filmName, celebrityName, initialPosterElements, initialPosters }: Props) {
  const [phase, setPhase] = useState<Phase>(initialPosters.length > 0 ? 'ready' : 'generating');
  const [posters, setPosters] = useState<Poster[]>(initialPosters);
  const [posterElements, setPosterElements] = useState<PosterElements | null>(initialPosterElements);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

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
    if (initialPosters.length === 0) {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPoster = useCallback(
    async (posterId: string) => {
      setSelecting(posterId);
      try {
        const res = await fetch(`/api/poster/select/${posterId}`, { method: 'POST' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to select poster');
        }
        setPosters((prev) => prev.map((p) => ({ ...p, selected: p.id === posterId })));
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Failed to select poster');
      } finally {
        setSelecting(null);
      }
    },
    []
  );

  if (phase === 'generating') {
    return (
      <BotScene
        state="reveal"
        questionLabel={`${filmName} · ${celebrityName}`}
        questionText="✦ Poster generating — based on everything you just told me..."
        statusText="✦ Generating your poster"
        footerRight={filmName}
      />
    );
  }

  if (phase === 'error') {
    return (
      <BotScene state="idle" questionLabel={`${filmName} · ${celebrityName}`} questionText={errorMsg || 'Something went wrong.'} footerRight={filmName}>
        <button type="button" className="interview-btn" onClick={generate}>
          Retry
        </button>
      </BotScene>
    );
  }

  return (
    <div className="reveal-wrap">
      <div className="reveal-header">
        <div className="bot-name">sc·ai</div>
        <div className="bot-sub">Your poster · {filmName}</div>
        {posterElements?.tagline && <p className="reveal-tagline">&ldquo;{posterElements.tagline}&rdquo;</p>}
      </div>

      <div className="reveal-grid">
        {posters.map((poster) => (
          <div key={poster.id} className={`reveal-card ${poster.selected ? 'reveal-selected' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster.storage_url} alt={`${filmName} poster variant ${poster.variant_index}`} className="reveal-img" />
            <button
              type="button"
              className="reveal-select-btn"
              disabled={selecting === poster.id}
              onClick={() => selectPoster(poster.id)}
            >
              {poster.selected ? '✓ Selected' : selecting === poster.id ? 'Selecting...' : 'Select this poster'}
            </button>
          </div>
        ))}
      </div>

      {errorMsg && <p className="reveal-tagline">{errorMsg}</p>}
    </div>
  );
}
