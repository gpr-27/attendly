# Cursor Plugins & MCP Recommendations — Attendly

**Status:** Research guide only — **do not install cloud auth/DB into the app** while personal v1 is Dexie-only.  
**Audience:** You + Cursor agents setting up later phases with minimal manual busywork.  
**Product context:** Next.js PWA · Dexie IndexedDB · Vercel · Groq + Gemini · Clerk/DB deferred ([plan](./AI-attendance-system-plan.md), [later ideas](./future-improvements.md)).

**Marketplace:** [cursor.com/marketplace](https://cursor.com/marketplace) · Cursor **Settings → Tools & MCP** / Plugins.

---

## How to use this guide

1. **Now (Dexie v1):** Keep shipping attendance UX. Optional: Vercel MCP auth, Context7, Chrome DevTools — no cloud DB/auth in code.
2. **When securing the deploy:** Clerk plugin + allowlist your user.
3. **When you want phone + laptop sync:** Supabase (or Neon) Postgres + keep Dexie as offline cache.
4. **Only if you open the app to others:** Upstash Redis rate limits, analytics, stricter quotas.

Agents can do most wiring once you complete **one-time OAuth / API key** clicks listed in the table.

---

## Already available in this Cursor environment

| Source | What you have | Attendly relevance |
|--------|---------------|-------------------|
| **Cursor Marketplace plugins (cached)** | Vercel, Clerk, Supabase, MongoDB (+ others like Stripe, Render, AWS…) | Exact stack for later phases — enable/auth when needed |
| **MCP tools (session)** | `plugin-vercel-vercel` (needs auth), `plugin-clerk-clerk`, `plugin-supabase-supabase`, `plugin-mongodb-mongodb`, Chrome DevTools, Context7 pattern via marketplace | Agents can already use Clerk snippets, Supabase project ops, Mongo docs |
| **User `~/.cursor/mcp.json`** | TinyFish, Magic UI, Swiggy (unrelated) | TinyFish for docs/research; Magic optional for UI |
| **Vercel agent skills** | `auth`, `marketplace`, `vercel-storage`, `deployments-cicd`, `nextjs`, `ai-sdk`, … | Prefer these when implementing later |

**Action now (optional, no app code):** In Cursor Settings → Plugins / Tools & MCP, ensure **Vercel**, **Clerk**, and **Supabase** are installed; click **Authenticate** once per server so agents can provision later without re-asking.

---

## Auth comparison (for Attendly later)

| Option | Fit for Attendly | Why | Agent setup |
|--------|------------------|-----|-------------|
| **Clerk** ✅ **recommended** | Personal deploy gate + Google/email; allowlist your user id; protects `/api/ai/*` | Matches [future-improvements](./future-improvements.md) tier A; native **Vercel Marketplace** (auto env vars); Cursor plugin + `clerk` CLI (`clerk init` / `clerk env pull`) | High automation after one Clerk login |
| **Supabase Auth** | Good if you want **one vendor** for auth + Postgres | Solid RLS story; less separate billing; overlaps Clerk if you also want Clerk UI/Marketplace | High via Supabase MCP + skills |
| **Auth0** | Skip for personal | Heavier enterprise surface; Cursor has Auth0 skill but overkill for one user | More dashboard work |
| **Firebase Auth** | Only if you pick Firebase for push + storage as a stack | Splits away from Vercel-native path | Firebase plugin exists; not preferred |

**Decision:** **Clerk for login** + **Supabase Postgres (or Neon) for sync**. Do not add both Clerk and Supabase Auth unless you have a strong reason.

---

## Database / cache roles (for THIS app)

| Service | Role for Attendly | When |
|---------|-------------------|------|
| **Dexie (IndexedDB)** | Source of truth **today**; later = offline cache | Always (v1) |
| **Supabase Postgres** ✅ | Cloud source of truth after login; RLS per `clerk_user_id` / your uid; sync subjects, timetable, marks | After Clerk (or with Supabase Auth) |
| **Neon Postgres** | Same as Supabase DB role; excellent Vercel Marketplace + Cursor Neon plugin; branchable DB for agents | Alternative to Supabase if you only need Postgres (no Supabase Storage/Auth) |
| **MongoDB Atlas** | Optional **side store only**: AI chat logs, raw Gemini import JSON, analytics events | Stretch / never primary attendance DB |
| **Upstash Redis** | Rate-limit `/api/ai/*`, short-lived insight cache | Only if traffic / multi-user; **not** attendance storage |
| **Vercel Blob** | Timetable photos, encrypted weekly JSON backups | After auth, if Settings export isn’t enough |
| **Prisma** (plugin) | ORM helper if you choose Neon/Postgres | When you add cloud schema |

---

## Prioritized table

| Plugin / MCP | Purpose for Attendly | When to add | What Cursor can do | What you must provide once |
|--------------|----------------------|-------------|--------------------|----------------------------|
| **Vercel** (Marketplace plugin + MCP) | Deploy, env, logs, project link; Marketplace integrations (Clerk/Neon/Upstash) | **Now** (hosting) — auth MCP when ready | `vercel link`, set env, deploy, discover integrations; with MCP: inspect deployments | Vercel account login / MCP OAuth; `vercel login` if CLI |
| **Context7** (Upstash Context7 MCP) | Up-to-date Next/Dexie/Clerk/Supabase docs in agent context | **Now** (optional quality) | Pull version-specific docs on demand | Install plugin (usually no key) |
| **Chrome DevTools MCP** / Browser tools | Debug PWA UI, console, network, Lighthouse | **Now** (dev) | Snapshots, console, network, a11y checks | Browser tab / allow automation |
| **TinyFish** (already in mcp.json) | Research marketplace/docs without manual browsing | **Now** | Search + fetch docs | Already configured |
| **Clerk** (plugin + MCP + skills) | Sign-in; protect AI routes; personal allowlist | **Phase A1** — secure personal deploy | Scaffold `@clerk/nextjs`, middleware, snippets; `clerk init` / `env pull` via CLI | Clerk account OAuth; approve Google OAuth provider in Clerk Dashboard if using Google; paste keys to Vercel if not Marketplace-provisioned |
| **Supabase** (plugin + MCP + skills) | Postgres schema, migrations, RLS, project URL/keys | **Phase A2** — multi-device sync | Create project (or use existing), `apply_migration`, RLS policies, list tables, advisors | Supabase login / MCP auth; pick org; confirm billing tier |
| **Neon Postgres** (plugin + MCP) | Alternate Postgres; agent-friendly branching | **Phase A2 alt** if not Supabase | Create DB/branches, connection strings, schema help | Neon OAuth; link to Vercel project |
| **Prisma** (plugin) | Typed schema/migrations against Postgres | With Neon/Supabase schema work | Generate schema, migrate patterns | DB URL in env (from Neon/Supabase) |
| **Vercel Blob** (via Vercel storage / Marketplace) | Photo / backup blob storage | When backups beyond JSON export | Wire `@vercel/blob` + env via Marketplace | Enable Blob on Vercel project (one click / CLI integration) |
| **Resend** (plugin + MCP) | Email yourself weekly attendance JSON backup | Phase A3 polish | Scaffold send API, React Email templates | Resend API key; **verify domain** (or use onboarding domain limits) |
| **OneSignal** (MCP) | **Server** Web Push when app is fully closed / multi-device | After local PWA timers aren’t enough (v1 already has client-local notifications) | Configure app ids, push wiring guidance | OneSignal app + Web Push certs / VAPID; browser notification permission |
| **Firebase** (plugin) | Alt for FCM Web Push + optional Storage | Only if you prefer Google push stack over OneSignal | Skills for Auth/Hosting/Messaging | Firebase project + service account / web config |
| **Sentry** (plugin + MCP) | Production error traces on Vercel | Optional after first real deploy | Instrument Next.js, triage issues | Sentry org OAuth; DSN in env |
| **PostHog** (plugin) | Product analytics / flags (personal use = low need) | Only if you care about usage funnels | Instrument events, flags | PostHog project API key |
| **Upstash Redis** (Vercel Marketplace; Redis skills/plugin) | Rate-limit AI endpoints | Multi-user / abuse risk | Provision via `vercel integration`, wire `@upstash/ratelimit` | Upstash/Vercel Marketplace accept |
| **MongoDB** (plugin + MCP) | Side logs / import dumps — **not** marks | Stretch C | Explore collections, indexes, Atlas guidance | Atlas connection string / MCP auth |
| **Auth0** (skill/plugin) | Enterprise auth | **Do not** for Attendly personal | Framework auth guides | Auth0 tenant (skip) |
| **Stripe** (you have plugin cached) | Payments | **Do not** while personal-only | Billing scaffolding | — |
| **Playwright / Browser Use / Subtext** | E2E UI proof on real browser | Optional when testing mark ritual / PWA | Automate flows, screenshots | Allow browser; optional cloud credits |
| **Figma** | Design → code | Only if designing outside code | Read frames | Figma OAuth |
| **GitHub MCP** (if added) | Issues/PRs from agent | Optional workflow | Open PRs, triage CI | GitHub auth |

---

## Recommended phased install order

### Phase 0 — Dexie personal v1 (current)

Install/auth only:

1. **Vercel** plugin → authenticate MCP  
2. **Context7** (optional)  
3. Keep **Chrome DevTools** / TinyFish  

Do **not** wire Clerk/DB into the Next.js app yet.

### Phase 1 — Secure personal deploy

1. Authenticate **Clerk** plugin  
2. Prefer **Vercel Marketplace → Clerk** so env vars auto-provision, **or** `clerk init` / `clerk env pull`  
3. Agent: middleware + allowlist your `userId` + protect `/api/ai/*`  
4. You: approve sign-in methods (Google/email) in Clerk Dashboard once  

### Phase 2 — Multi-device sync

1. Authenticate **Supabase** **or** **Neon** (pick one Postgres)  
2. Agent: tables for subjects / sessions / marks + RLS keyed to your Clerk id  
3. Agent: Dexie remains offline cache; sync on online  
4. You: confirm project region + copy URL/anon/service keys if Marketplace didn’t inject them  

### Phase 3 — Nudges & backups

1. **Resend** (email backup) and/or **Vercel Blob**  
2. **OneSignal** (or Firebase) only if you need **server** Web Push beyond existing local PWA timers  
3. Optional **Sentry** after you’ve used the PWA for a week  

### Phase 4 — Only if not “you only” anymore

1. **Upstash Redis** rate limits  
2. **MongoDB** optional AI log sink  
3. Analytics (PostHog) if productizing  

---

## Do NOT add yet (personal Dexie-only phase)

Do not install into **app code** or treat as required for v1:

- Clerk / Auth0 / Supabase Auth / Firebase Auth UI walls  
- Supabase Postgres, Neon, Prisma migrations as required runtime  
- MongoDB Atlas as attendance store  
- Upstash Redis / Vercel KV  
- Resend, OneSignal, Firebase Messaging  
- Stripe, WorkOS, enterprise SSO  
- Datadog/Amplitude-style heavy analytics  
- Extra AI provider plugins (OpenAI, Hugging Face, etc.) unless Groq/Gemini fail permanently  

Safe to **install Cursor plugins early** (Clerk/Supabase/Vercel) for agent readiness — just don’t change the Dexie-only product lock until you decide Phase 1+.

---

## AI providers (no special Cursor plugin required)

| Provider | Role today | Cursor automation | You provide once |
|----------|------------|-------------------|------------------|
| **Groq** | Coach chat + insight; vision backup | Wire routes/env; use Context7/docs | `GROQ_API_KEY` in `.env.local` + Vercel env |
| **Gemini** | Timetable photo parse | Same | `GEMINI_API_KEY` (+ optional `GEMINI_MODEL`) |
| **Vercel AI Gateway / AI SDK skills** | Optional unified proxy later | Vercel skills help configure | Gateway key if used |
| **Others (OpenAI, etc.)** | Not needed | Skip | — |

---

## What agents automate vs what you must click

### Agents can usually do

- Scaffold packages, middleware, API routes, Dexie↔Postgres sync code  
- Apply Supabase/Neon migrations via MCP  
- Pull Clerk/Vercel env into project files (CLI / Marketplace)  
- Deploy with Vercel CLI after link  
- Instrument Sentry/Resend/OneSignal **code** once keys exist  
- Write RLS policies and allowlists  
- Run tests / Playwright checks  

### You must do once (cannot fully skip)

| One-time human step | Why |
|---------------------|-----|
| Create/login accounts (Vercel, Clerk, Supabase/Neon, Groq, Gemini, …) | Identity / billing |
| Approve MCP / plugin OAuth in Cursor | Token for agents |
| `vercel link` / Marketplace “Add” confirmation | Project binding |
| Domain verify (Resend custom domain) | Email deliverability |
| Google Cloud / OAuth consent if required outside Clerk’s hosted flow | Provider policy |
| Browser notification permission on your phone | Push UX |
| Paste secrets into Vercel if not auto-provisioned | Security boundary |
| Confirm paid tier / free-tier limits | Avoid surprise bills |

---

## Suggested “ask the agent” prompts (later)

```text
Authenticate Vercel MCP if needed, link this repo, and list env vars
(without printing secret values). Do not add Clerk or any database yet.
```

```text
Using the Clerk Cursor plugin and clerk CLI, add Clerk to Attendly with
an allowlist of only my user id. Protect /api/ai/*. Keep Dexie as the
only attendance store for now.
```

```text
Using Supabase MCP, create sync tables for subjects, timetable slots,
and attendance marks with RLS for my Clerk user id. Scaffold Dexie
offline cache + sync. Do not replace local-first UX.
```

---

## Quick decision cheatsheet

| Need | Choose |
|------|--------|
| Host the PWA | **Vercel** |
| Login later | **Clerk** |
| Sync phone + laptop | **Supabase Postgres** (or **Neon**) + Dexie cache |
| Rate-limit AI later | **Upstash Redis** |
| Email yourself backups | **Resend** |
| Class mark push nudges | **OneSignal** (or Firebase) |
| Store timetable images | **Vercel Blob** |
| Attendance rows forever | **Never Mongo/Redis alone** |

---

## Links

- [Cursor Marketplace](https://cursor.com/marketplace)  
- [Vercel Marketplace](https://vercel.com/marketplace)  
- [Clerk Cursor plugin](https://github.com/clerk/cursor-plugin)  
- [Neon × Cursor](https://neon.com/blog/neon-is-a-cursor-plugin)  
- [Attendly plan](./AI-attendance-system-plan.md) · [Future improvements](./future-improvements.md) · [Implementation journal](./IMPLEMENTATION-JOURNAL.md)

*Last researched: 2026-08-05 against Cursor Marketplace listings + this workspace’s installed plugins/MCPs.*
