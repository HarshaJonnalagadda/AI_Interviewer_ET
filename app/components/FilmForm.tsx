'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FilmConfig, Language } from '@/lib/types';

interface FilmFormProps {
  mode: 'create' | 'edit';
  initial?: FilmConfig;
}

export default function FilmForm({ mode, initial }: FilmFormProps) {
  const router = useRouter();
  const [filmName, setFilmName] = useState(initial?.film_name ?? '');
  const [language, setLanguage] = useState<Language>(initial?.language ?? 'te');
  const [releaseYear, setReleaseYear] = useState(initial?.release_year ?? '');
  const [celebrityName, setCelebrityName] = useState(initial?.celebrity_name ?? '');
  const [celebrityRole, setCelebrityRole] = useState(initial?.celebrity_role ?? 'Lead Actor');
  const [celebrityPronoun, setCelebrityPronoun] = useState(initial?.celebrity_pronoun ?? 'they');
  const [questionCount, setQuestionCount] = useState(initial?.question_count ?? 7);
  const [avoidTopics, setAvoidTopics] = useState((initial?.avoid_topics ?? []).join(', '));
  const [sessionTitle, setSessionTitle] = useState(initial?.session_title ?? '');
  const [contextNotes, setContextNotes] = useState(initial?.context_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      filmName,
      language,
      releaseYear,
      celebrityName,
      celebrityRole,
      celebrityPronoun,
      questionCount: Number(questionCount),
      avoidTopics: avoidTopics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      sessionTitle,
      contextNotes,
    };

    try {
      if (mode === 'create') {
        const res = await fetch('/api/admin/film', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create film');
        router.push(`/admin/setup/${data.film.slug}`);
      } else {
        const res = await fetch(`/api/admin/film/${initial!.slug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save film');
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-panel" onSubmit={submit}>
      <h2>Film Identity</h2>
      <div className="admin-form-grid">
        <label>
          Film Name
          <input value={filmName} onChange={(e) => setFilmName(e.target.value)} required />
        </label>
        <label>
          Language
          <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            <option value="te">Telugu</option>
            <option value="hi">Hindi</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          Release Year
          <input value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} placeholder="2026" />
        </label>
        <label>
          Celebrity Name
          <input value={celebrityName} onChange={(e) => setCelebrityName(e.target.value)} required />
        </label>
        <label>
          Celebrity Role
          <input value={celebrityRole} onChange={(e) => setCelebrityRole(e.target.value)} required />
        </label>
        <label>
          Celebrity Pronoun
          <select value={celebrityPronoun} onChange={(e) => setCelebrityPronoun(e.target.value)}>
            <option value="he/him">He/Him</option>
            <option value="she/her">She/Her</option>
            <option value="they">They/Them</option>
          </select>
        </label>
        <label>
          Question Count
          <input
            type="number"
            min={3}
            max={12}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
          />
        </label>
        <label>
          Session Title
          <input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} placeholder="Paradise Promo — June 2026" />
        </label>
        <label className="admin-form-full">
          Avoid Topics (comma separated)
          <input value={avoidTopics} onChange={(e) => setAvoidTopics(e.target.value)} placeholder="personal life, salary" />
        </label>
        <label className="admin-form-full">
          Context Notes
          <textarea
            rows={6}
            value={contextNotes}
            onChange={(e) => setContextNotes(e.target.value)}
            placeholder="Plot summary, visual themes, trailer highlights, fan reactions — anything that should shape the interview."
          />
        </label>
      </div>

      {error && <div className="login-error">{error}</div>}
      <button className="login-btn" type="submit" disabled={saving}>
        {saving ? 'Saving…' : mode === 'create' ? 'Create Film' : 'Save Changes'}
      </button>
    </form>
  );
}
