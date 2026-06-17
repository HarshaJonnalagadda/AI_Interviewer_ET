'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

interface SessionPoster {
  storage_url: string;
  selected: boolean | null;
}

interface Session {
  id: string;
  film_name: string;
  celebrity_name: string;
  status: string;
  created_at: string;
  posters: SessionPoster[];
}

interface Props {
  sessions: Session[];
}

export default function SessionsPanel({ sessions }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const posterSessions = sessions.filter((s) => s.posters?.length > 0);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadSelected = useCallback(() => {
    const selected = sessions.filter((s) => selectedIds.has(s.id));
    // Route through /api/download/poster proxy — avoids CORS and browser
    // async-gesture restrictions. Each <a> click is synchronous.
    for (const session of selected) {
      for (let i = 0; i < session.posters.length; i++) {
        const poster = session.posters[i];
        const filename = `${session.film_name.replace(/\s+/g, '-')}-${session.celebrity_name.replace(/\s+/g, '-')}-poster-${i + 1}.png`;
        const proxyUrl = `/api/download/poster?url=${encodeURIComponent(poster.storage_url)}&filename=${encodeURIComponent(filename)}`;
        const a = document.createElement('a');
        a.href = proxyUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  }, [sessions, selectedIds]);

  const selectedCount = selectedIds.size;
  const totalPosters = sessions
    .filter((s) => selectedIds.has(s.id))
    .reduce((acc, s) => acc + s.posters.length, 0);

  return (
    <div className="admin-list">
      {!sessions?.length && <div className="admin-empty">No sessions yet.</div>}

      {selectedCount > 0 && (
        <div className="sessions-dl-bar">
          <span className="sessions-dl-label">
            {selectedCount} session{selectedCount > 1 ? 's' : ''} · {totalPosters} poster{totalPosters !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            className="sessions-dl-btn"
            onClick={downloadSelected}
          >
            {selectedCount > 1 ? `Download ${selectedCount} Posters` : 'Download Poster'}
          </button>
        </div>
      )}

      {sessions?.map((session) => {
        const hasPosters = session.posters?.length > 0;
        const isSelected = selectedIds.has(session.id);

        return (
          <div
            key={session.id}
            className={`admin-row${isSelected ? ' admin-row-selected' : ''}`}
            onClick={hasPosters ? () => toggleSelect(session.id) : undefined}
            style={hasPosters ? { cursor: 'pointer' } : undefined}
          >
            <div style={{ flex: 1 }}>
              <div className="admin-row-title">
                {session.film_name} — {session.celebrity_name}
                {hasPosters && (
                  <span className="sessions-poster-badge">
                    {isSelected ? '✓' : `${session.posters.length} poster${session.posters.length > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
              <div className="admin-row-sub">
                {new Date(session.created_at).toLocaleDateString()} · {session.status}
              </div>
            </div>
            <div className="admin-row-actions" onClick={(e) => e.stopPropagation()}>
              <Link href={`/admin/session/${session.id}`} className="admin-link">View</Link>
              {session.status !== 'completed' && session.status !== 'poster_generated' && (
                <Link href={`/interview/${session.id}`} className="admin-link">▶ Interview</Link>
              )}
            </div>
          </div>
        );
      })}

      {posterSessions.length > 0 && selectedCount === 0 && (
        <p className="sessions-dl-hint">Tap a session with posters to select</p>
      )}
    </div>
  );
}
