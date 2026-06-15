# StarCanvas — sc·ai

Live AI-powered celebrity interview platform. Two services:

- **`/`** — Next.js 14 (App Router, TypeScript, Tailwind). Auth, database, admin dashboard, live interview UI, poster reveal.
- **`/ai-service`** — Python FastAPI microservice. All AI provider calls (Anthropic Claude, Sarvam, OpenAI Whisper, ElevenLabs, Ideogram).

The Next.js app never talks to AI providers directly — it calls `/ai-service` over HTTP with a shared bearer token.

## Setup

### 1. Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Create a **public** storage bucket named `posters` (see comment at the bottom of the migration).

### 2. ai-service (Python)

```bash
cd ai-service
python -m venv .venv
.venv/Scripts/activate   # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env
# fill in ANTHROPIC_API_KEY, SARVAM_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY,
# IDEOGRAM_API_KEY, AI_SERVICE_API_KEY (shared secret with the Next.js app)
uvicorn app.main:app --reload --port 8000
```

### 3. Next.js

```bash
npm install
cp .env.local.example .env.local
# fill in Supabase keys, AI_SERVICE_URL / AI_SERVICE_API_KEY (matching ai-service),
# RESEND_API_KEY, SESSION_SECRET (openssl rand -hex 32), OTP_FROM_EMAIL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`. The first email you log in with is auto-registered as an admin.

## Flow

1. **Admin** (`/admin`) — create a film config, add context notes, run the intelligence synthesis pack, then start an interview session.
2. **Live interview** (`/interview/[sessionId]`) — the sc·ai bot greets the celebrity, asks questions, records/transcribes/translates answers, and asks follow-ups until Claude signals the interview is complete.
3. **Poster reveal** (`/interview/[sessionId]/reveal`) — extracts poster design elements from the transcript and generates poster variants via Ideogram for selection.
4. **Session archive** (`/admin/session/[id]`) — full transcript + generated posters for any past session.

## Deploying

- **ai-service**: deploy to any Python host that supports long-running HTTP services (Railway, Fly.io, Render, etc — not Vercel, since image generation requests can run long). Set the same `AI_SERVICE_API_KEY` as the Next.js app.
- **Next.js**: deploy to Vercel. Set `AI_SERVICE_URL` to the deployed ai-service URL.
