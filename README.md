# Attendly

Personal AI attendance co-pilot. Mark classes, track bunk %, plan skips — data stays **on your device** (Dexie → IndexedDB). Deploy the app to **Vercel**; attendance rows never leave the browser.

**Not a multi-user product.** No login, no Clerk, no Postgres/Mongo/Redis.

## Personal local use + Vercel deploy path

| Mode | What happens |
|------|----------------|
| Local (`npm run dev`) | PWA UI + Dexie in your browser. Optional AI via `.env.local`. |
| Vercel (`npm run build` → deploy) | Hosts the Next.js app + `/api/ai/*` proxies. Your marks stay in **that device’s** IndexedDB. |

Different devices = separate local data (no cloud sync in v1).

## Setup

```bash
npm install
cp .env.example .env.local   # then fill keys if you want AI
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). First visit → **Onboarding** (you pick criteria / semester — nothing is pre-seeded).

### Environment variables

| Variable | Required? | Where | Purpose |
|----------|-----------|--------|---------|
| `GROQ_API_KEY` | For coach / AI chat | `.env.local` or Vercel → Environment Variables | Insights coach (`POST /api/ai/coach`); backup for photo/text parse |
| `GEMINI_API_KEY` | For photo import | same | Timetable photo parse (`POST /api/ai/parse-timetable`) |
| `GEMINI_MODEL` | Optional | same | Override Gemini model (default `gemini-2.0-flash`) |
| `GROQ_MODEL` | Optional | same | Primary coach model (default `llama-3.3-70b-versatile`) |
| `GROQ_FALLBACK_MODEL` | Optional | same | Retry model on 429/503 (default `llama-3.1-8b-instant`) |

Keys are **server-only** (`process.env` in Route Handlers). The app works without them for math + marking; AI features return a clear error until keys are set.

**Never commit `.env.local`.** (gitignored via `.env*`; only `.env.example` is safe to commit.)

### Vercel

Framework preset: **Next.js**. Build: `npm run build`. No `vercel.json` needed (standard App Router deploy).

1. Commit + push the repo (GitHub/GitLab/Bitbucket), **or** run `npx vercel` from this folder
2. Import on [Vercel](https://vercel.com) → Project Settings → Environment Variables
3. Set at least `GROQ_API_KEY` and `GEMINI_API_KEY` for Production (and Preview if you want AI on preview deploys)
4. Deploy. Install as PWA on your phone from the site.

**Caveats:** Marks live in the browser’s IndexedDB (not on Vercel). Share schedule structure via Settings → schedule export/import (no marks). Attendance summary out = Download PDF. Groq/Gemini rate limits apply on free tiers.

## Scripts

```bash
npm run dev          # local app
npm run build        # production build (must pass before deploy)
npm run test         # unit + integration (vitest)
npm run test:watch   # vitest watch
npm run test:e2e     # points to manual checklist (Playwright optional later)
```

## Data model (on-device)

Dexie stores: `settings`, `subjects`, `timetableSeries`, `seriesExceptions`, `calendarBlocks`, `classSessions`, `attendanceRecords`.

- **Marks out:** **Download attendance PDF** (Settings / Analytics / Today)
- **Schedule for friends / other devices:** Settings → export/import schedule JSON (**no attendance marks**)
- Clearing site data wipes local Dexie data

## Tests

See `test/` and `test/E2E-CHECKLIST.md`. Automated suites use fixtures created in test code only — the app never ships demo subjects.

## Docs

- `docs/AI-attendance-system-plan.md` — v1 plan
- `docs/future-improvements.md` — later (Clerk, sync, etc.) — **not built**
- `docs/IMPLEMENTATION-JOURNAL.md` — living changelog
