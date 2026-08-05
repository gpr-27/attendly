# Attendly

Personal AI attendance co-pilot. Mark classes, track bunk %, plan skips.

**Auth:** Clerk sign-in required for the app. Signed-out visitors see a landing page only.  
**Data:** Dexie offline cache per Clerk user + **Supabase Postgres** sync when online. Marks and schedule sync to your cloud account; Dexie is the on-device cache.

Live: [attendly-navy.vercel.app](https://attendly-navy.vercel.app) · Repo: [gpr-27/attendly](https://github.com/gpr-27/attendly)

## Modes

| Mode | What happens |
|------|----------------|
| Local (`npm run dev`) | PWA UI + per-user Dexie in your browser. Clerk + optional AI via `.env.local`. |
| Vercel (`npm run build` → deploy) | Hosts Next.js + `/api/ai/*`. Marks stay in that browser’s IndexedDB under `AttendlyDB_u_<userId>`. |

Different devices / browsers share data after sign-in once sync completes (same Clerk account).

## Setup

```bash
npm install
cp .env.example .env.local   # fill Clerk + optional AI keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in → first visit runs **Onboarding** (criteria / semester — nothing is pre-seeded).

### Environment variables

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk client |
| `CLERK_SECRET_KEY` | Yes | Clerk server |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Recommended | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Recommended | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Recommended | `/` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Recommended | `/` |
| `GROQ_API_KEY` | For coach / AI chat | Insights coach (`POST /api/ai/coach`) |
| `GEMINI_API_KEY` | For photo import | Timetable photo parse |
| `GEMINI_MODEL` | Optional | Default `gemini-2.0-flash` |
| `GROQ_MODEL` | Optional | Default `llama-3.3-70b-versatile` |
| `GROQ_FALLBACK_MODEL` | Optional | Default `llama-3.1-8b-instant` |

Keys are **server-only** except `NEXT_PUBLIC_*`. App math + marking work without AI keys; AI routes return a clear error until set.

**Never commit `.env.local`.**

### Vercel

Framework: **Next.js**. Build: `npm run build`.

1. Push to GitHub (`gpr-27/attendly`) — Vercel project **attendly** is connected
2. Project Settings → Environment Variables (Production + Preview): Clerk keys + `GROQ_API_KEY` / `GEMINI_API_KEY`
3. Deploy. Install as PWA from the site.

**Caveats:** Marks live in IndexedDB (not on Vercel). Share schedule structure via Settings → schedule export/import (no marks). Attendance summary out = Download PDF.

## Scripts

```bash
npm run dev          # local app
npm run build        # production build (must pass before deploy)
npm run test         # unit + integration (vitest)
npm run test:watch   # vitest watch
npm run test:e2e     # points to manual checklist
```

## Data model (on-device)

Dexie stores (per signed-in user): `settings`, `subjects`, `timetableSeries`, `seriesExceptions`, `calendarBlocks`, `classSessions`, `attendanceRecords`.

- **Marks out:** Download attendance PDF (Settings / Analytics / Today)
- **Schedule for friends / other devices:** Settings → export/import schedule JSON (**no attendance marks**)
- Clearing site data wipes that browser’s Dexie data

## Docs

- `docs/PRODUCT-ROADMAP.md` — **feature review, gaps, and what to build next** (AI + product)
- `docs/AI-attendance-system-plan.md` — v1 plan
- `docs/UI-COMPONENT-MAP.md` — responsive UI map
- `docs/future-improvements.md` — earlier idea archive (see roadmap for current state)
- `docs/IMPLEMENTATION-JOURNAL.md` — living changelog
