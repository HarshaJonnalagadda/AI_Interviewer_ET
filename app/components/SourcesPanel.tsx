'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { IngestionSource, IngestionSourceType } from '@/lib/types';

interface SourcesPanelProps {
  slug: string;
  initialSources: IngestionSource[];
}

const YOUTUBE_TYPES: { value: IngestionSourceType; label: string }[] = [
  { value: 'teaser', label: 'Teaser' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'song', label: 'Song' },
  { value: 'interview', label: 'Interview' },
];

function StatusBadge({ source }: { source: IngestionSource }) {
  switch (source.status) {
    case 'done':
      return <span className="status-ok">✓ Done</span>;
    case 'processing':
      return <span className="status-pending">⏳ Processing</span>;
    case 'failed':
      return <span className="source-status-failed">✗ Failed</span>;
    default:
      return <span className="status-pending">⏳ Pending</span>;
  }
}

export default function SourcesPanel({ slug, initialSources }: SourcesPanelProps) {
  const router = useRouter();
  const [sources, setSources] = useState<IngestionSource[]>(initialSources);
  const [youtubeType, setYoutubeType] = useState<IngestionSourceType>('teaser');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const posters = sources.filter((s) => s.source_type === 'poster');
  const youtubeLinks = sources.filter((s) => ['teaser', 'trailer', 'song', 'interview'].includes(s.source_type));
  const references = sources.filter((s) => s.source_type === 'reference');

  const refresh = async () => {
    const res = await fetch(`/api/admin/film/${slug}/sources`);
    const data = await res.json();
    if (res.ok) setSources(data.sources);
  };

  const addLink = async (sourceType: IngestionSourceType, url: string, clear: () => void) => {
    if (!url.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/film/${slug}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType, sourceUrl: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add source');
      setSources((prev) => [...prev, data.source]);
      clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const deleteSource = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/film/${slug}/sources/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete source');
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  };

  const uploadFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/admin/film/${slug}/sources/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload image');
      setSources((prev) => [...prev, data.source]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const uploadImageUrl = async (imageUrl: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/film/${slug}/sources/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch image');
      setSources((prev) => [...prev, data.source]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((f) => uploadFile(f));
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          uploadFile(file);
          return;
        }
      }
    }
    const text = e.clipboardData.getData('text');
    if (text && /^https?:\/\/\S+$/.test(text.trim())) {
      e.preventDefault();
      uploadImageUrl(text.trim());
    }
  };

  const runIngestion = async () => {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch(`/api/admin/film/${slug}/sources/process`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ingestion failed');
      await refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setRunning(false);
    }
  };

  const pendingCount = sources.filter((s) => s.status === 'pending' || s.status === 'failed').length;

  return (
    <div className="admin-panel">
      <h2>Source Inputs</h2>

      <div className="sources-section">
        <div className="sources-section-label">Posters</div>
        <div className="poster-grid">
          {posters.map((p) => (
            <div key={p.id} className="poster-thumb">
              {p.file_path && <img src={p.file_path} alt="Poster" />}
              <div className="poster-thumb-status">
                <StatusBadge source={p} />
              </div>
              <button className="source-delete" onClick={() => deleteSource(p.id)} title="Remove">×</button>
              {p.result?.summary && <div className="source-summary">{p.result.summary}</div>}
              {p.error_message && <div className="source-error">{p.error_message}</div>}
            </div>
          ))}
          <div className="poster-add" onPaste={handlePaste} tabIndex={0}>
            <button className="login-link" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              + Upload Images
            </button>
            <div className="poster-add-hint">or paste an image / image URL here</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
          </div>
        </div>
      </div>

      <div className="sources-section">
        <div className="sources-section-label">YouTube Links</div>
        <div className="source-list">
          {youtubeLinks.map((s) => (
            <div key={s.id} className="source-row">
              <span className="source-type-tag">{s.source_type}</span>
              <a className="source-url" href={s.source_url ?? '#'} target="_blank" rel="noreferrer">
                {s.source_url}
              </a>
              <StatusBadge source={s} />
              <button className="source-delete" onClick={() => deleteSource(s.id)} title="Remove">×</button>
              {s.result?.label && <div className="source-summary">{s.result.label}</div>}
              {s.error_message && <div className="source-error">{s.error_message}</div>}
            </div>
          ))}
        </div>
        <div className="source-add-row">
          <select value={youtubeType} onChange={(e) => setYoutubeType(e.target.value as IngestionSourceType)}>
            {YOUTUBE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <button
            className="login-link"
            type="button"
            disabled={busy}
            onClick={() => addLink(youtubeType, youtubeUrl, () => setYoutubeUrl(''))}
          >
            + Add URL
          </button>
        </div>
      </div>

      <div className="sources-section">
        <div className="sources-section-label">Reference URLs</div>
        <div className="source-list">
          {references.map((s) => (
            <div key={s.id} className="source-row">
              <a className="source-url" href={s.source_url ?? '#'} target="_blank" rel="noreferrer">
                {s.source_url}
              </a>
              <StatusBadge source={s} />
              <button className="source-delete" onClick={() => deleteSource(s.id)} title="Remove">×</button>
              {s.result?.label && <div className="source-summary">{s.result.label}</div>}
              {s.error_message && <div className="source-error">{s.error_message}</div>}
            </div>
          ))}
        </div>
        <div className="source-add-row">
          <input
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            placeholder="https://example.com/article"
          />
          <button
            className="login-link"
            type="button"
            disabled={busy}
            onClick={() => addLink('reference', referenceUrl, () => setReferenceUrl(''))}
          >
            + Add
          </button>
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="admin-panel-actions">
        <button className="login-btn" onClick={runIngestion} disabled={running || pendingCount === 0}>
          {running ? 'Running Ingestion…' : `Run Ingestion${pendingCount ? ` (${pendingCount})` : ''}`}
        </button>
      </div>
    </div>
  );
}
