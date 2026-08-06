# Implementation Journal

Living log of how this personal AI Attendance app (**Attendly**) was built and updated.
Read this anytime to understand **what changed** and **where it lives**.

**Rules for agents:** After any meaningful code/docs change, APPEND a Changelog entry (newest first) and refresh Key files map / Architecture if structure changed. Prefer **APPEND-only** changelog edits to avoid clobbering parallel agents.

---

## How to read this

1. **Changelog** — newest work at the top (date/time + what + files)
2. **Code style & naming** — how we write code in this repo
3. **Key files map** — where to look for each feature
4. **Architecture snapshot** — how data & AI fit together
5. **How to run** — local + env

---

## Related docs

| Doc | Role |
|-----|------|
| [AI-attendance-system-plan.md](./AI-attendance-system-plan.md) | Product plan (v1) |
| [UI-COMPONENT-MAP.md](./UI-COMPONENT-MAP.md) | Target UI map for the responsive redesign (every component, desktop vs mobile) |
| [future-improvements.md](./future-improvements.md) | Earlier idea archive (see PRODUCT-ROADMAP for current) |
| [PRODUCT-ROADMAP.md](./PRODUCT-ROADMAP.md) | Full feature review + prioritized roadmap |
| [PLUGINS-RECOMMENDED.md](./PLUGINS-RECOMMENDED.md) | Cursor plugins / MCP / Marketplace for later auth, DB, deploy, push |

---

## Code style & naming

1. **Simple, easy-to-understand code**
   - Clear names over clever abstractions; small functions; obvious control flow
   - Light comments only where non-obvious
   - No over-engineering, deep nesting, or unnecessary hooks/memo
   - Types that read like English: `Subject`, `ClassSession`, `AttendanceStatus`

2. **File / folder naming**
   - App Router route folders: **kebab-case** (`onboarding`, stays flat for main tabs)
   - TS/TSX: idiomatic **camelCase** files / **PascalCase** components
   - Group by feature: `lib/db/`, `lib/attendance/`, `lib/timetable/`, `lib/ai/`, `components/today/`, `components/timetable/`, etc.
   - Names say what they are: `materialize-sessions.ts`, `bunk-math.ts`, `risk-banner.tsx` — not `utils2.ts`, `helpers.ts`, `temp.tsx`
   - One main export idea per file when practical; thin index barrels only

3. **Branding**
   - Product name in UI/metadata: **Attendly**
   - `package.json` name: `attendly`
   - Repo folder name stays as-is

---

## Changelog

### 2026-08-06 — Groups chat UX: scroll, members, delete
- **What:** Fixed group chat **scroll** (flex column + `min-h-0` overflow, auto-scroll on load/new messages when near bottom, mobile `100dvh` layout). Added **member count badge** (tap → members sheet) via `GET /api/groups/[id]/members`. Added **delete own messages** (hard delete, author or admin) via `DELETE /api/groups/[id]/messages/[messageId]` with ⋮ menu on own messages.
- **Delete policy:** Hard delete in v1 — no `deleted_at` migration needed. Documented in `deleteGroupMessage()` in `src/lib/groups/server.ts`.
- **Routes/API:** `GET /api/groups/[id]/members`, `DELETE /api/groups/[id]/messages/[messageId]`.
- **Files:** `src/lib/groups/server.ts`, `client.ts`, `types.ts`, `validation.ts`, `src/app/api/groups/[id]/members/route.ts`, `src/app/api/groups/[id]/messages/[messageId]/route.ts`, `src/components/groups/group-chat.tsx`, `group-detail-page.tsx`, `group-members-sheet.tsx`, `test/unit/groups/validation.test.ts`, this journal.
- **Verify:** `npm run test:unit` · `npm run build`. No new Supabase migration required.

### 2026-08-06 — Mobile hamburger navigation drawer
- **What:** On viewports below `md`, a **hamburger menu** in the top bar opens a slide-over drawer with **all** destinations from `nav-config.ts` (Today through Settings). Bottom tab bar kept for primary routes (Today, Timetable, Subjects, Coach, Settings); drawer exposes Groups, Plan, Calendar, Analytics, Import, etc. Drawer closes on link tap, backdrop tap, or Escape. Theme toggle + Clerk user controls live in the drawer footer. Desktop side nav unchanged.
- **Files:** `src/components/shell/mobile-nav-drawer.tsx` (new), `src/components/shell/app-frame.tsx`, this journal.

### 2026-08-06 — Public searchable groups + group chat (v1)
- **What:** Signed-in users can **search public groups**, **create** a group, **join/leave**, and **chat** with members. Data lives in **Supabase** (`groups`, `group_members`, `group_messages`) — not Dexie. Chat is text-only; no attendance marks in groups. Live updates use **HTTP polling** (~3s, `after` cursor) — not custom WebSockets (Supabase Realtime is a future upgrade).
- **Auth / security:** Same pattern as attendance sync — Clerk `auth().userId` on every API route; Supabase **service role** server-side only; RLS enabled with no anon policies.
- **Routes:** `/groups` (search + list), `/groups/new`, `/groups/[id]` (detail + chat). API: `/api/groups`, `/api/groups/[id]`, join/leave/messages.
- **Files:** `supabase/migrations/20260806000000_public_groups_chat.sql`, `src/lib/groups/*`, `src/app/api/groups/**`, `src/components/groups/*`, `src/app/groups/**`, `nav-config.ts`, `database.types.ts`, `test/unit/groups/validation.test.ts`, `UI-COMPONENT-MAP.md`, this journal.
- **Verify:** `npm run test:unit` · `npm run build` · migration applied to Supabase project `wulbivagfngyzreoefwo`.
- **For user:** Open **Groups** in the nav → search or create → join → chat. Requires Supabase env vars on Vercel (same as sync).

### 2026-08-05 — Supabase cloud DB + Clerk identity + Import → cloud
- **What:** Attendly attendance data is stored in **Supabase Postgres** (project `wulbivagfngyzreoefwo`, region `ap-south-1`). Dexie is the per-Clerk-user offline cache (`AttendlyDB_u_<userId>`); when online, **cloud is source of truth**.
- **Clerk ↔ Supabase identity (linked systems, not unrelated):**
  - **Tenant key:** every cloud row has `clerk_user_id` = Clerk `auth().userId` (same id as Dexie bind).
  - **v1 authZ path (chosen):** Next.js `/api/sync` uses Clerk session via `auth()` + Supabase **service role** server-side. Client never sends/trusts a userId; spoofed `clerkUserId` in body → 403. RLS enabled with **no** anon/authenticated policies (Data API locked). JWT template / third-party auth RLS (`auth.jwt()->>'sub'`) deferred — service-role + Clerk is the reliable v1 link.
  - **First sign-in:** `ensureClerkUserProfile(userId)` upserts a default `settings` row for that Clerk user (idempotent) on GET/PUT `/api/sync`.
  - **Dexie bind:** `UserDatabaseProvider` only runs after Clerk `userId` is present; sync pull/push uses cookie session → API → `auth().userId`.
- **Schema (mirrors Dexie):** `settings`, `subjects`, `timetable_series`, `series_exceptions`, `calendar_blocks`, `class_sessions`, `attendance_records`.
- **Sync flow:**
  1. After `bindDatabaseForUser` → `syncAfterBind()` → GET `/api/sync` (ensure profile + pull). Cloud data → replace Dexie; else local data → push.
  2. Repository mutations → debounced `scheduleCloudPush()`.
  3. **Settings → Import schedule JSON:** Dexie `importBackup` + rematerialize → **required** `pushLocalToCloud({ required: true })` for that Clerk user (marks cleared). Failure → `CloudSyncError` shown in UI.
- **Files:** `src/lib/supabase/{admin,clerk-identity,mappers,sync-server,snapshot,database.types}.ts`, `src/app/api/sync/route.ts`, `src/lib/db/cloud-sync.ts`, `export-import.ts`, `repository.ts`, `user-database-provider.tsx`, `schedule-backup-panel.tsx`, `.env.example`, this journal.
- **Env (Vercel Production/Preview):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus existing Clerk + `GROQ_API_KEY` / `GEMINI_API_KEY`.
- **Deps:** `@supabase/supabase-js@2.112.1`.
- **For user:** Sign in (Clerk) → cloud profile created → import/mark syncs under your Clerk id → other device pulls same data. Live: https://attendly-navy.vercel.app · https://supabase.com/dashboard/project/wulbivagfngyzreoefwo

### 2026-08-05 — Landing / auth desktop responsive fix + docs
- **Bug:** Signed-out landing / sign-in looked like a phone UI on laptop — `AppFrame` bare wrapper used `max-w-lg`, plus landing `max-w-md`.
- **What:** Bare shell is full viewport; landing uses `max-w-6xl` split (brand left, CTAs right on `lg+`; stacked full-width on phone). Sign-in / sign-up centered in wide chrome with larger Clerk card (~28rem). Onboarding keeps a readable `max-w-xl` form column. Clerk appearance: full-width card, taller inputs/buttons, modal max width. README corrected for Clerk-required auth + live URL. Today shell already had desktop grid — no cage change there.
- **Files:** `landing-page.tsx`, `app-frame.tsx`, `sign-in` / `sign-up` pages, `onboarding/page.tsx`, `onboarding-intro.tsx`, `clerk-appearance.ts`, `README.md`, `UI-COMPONENT-MAP.md`, this journal.
- **Verify:** `npm run build` · pushed `e58c8ec` · Vercel production **READY** on that SHA (`attendly-navy.vercel.app`). Desktop check: landing grid `672px | 320px` at 1280px width; no `max-w-lg` cage.
- **For user:** Open https://attendly-navy.vercel.app on a laptop — landing should read as a wide Attendly hero, not a skinny mobile column.

### 2026-08-05 — Fix import vanishing on production reload
- Root cause: `export-import.ts` captured `ALL_TABLES` from the unbound Dexie at module load, so imports could clear the user DB then write into `AttendlyDB__unbound`. Reload opened the empty per-user DB.
- Fix: resolve tables live via `allTables()`, require `getBoundUserId()`, verify subject count after import, set `onboarded: true` on import, adopt/clear leftover `__unbound` data on bind.

### 2026-08-05 — Per-Clerk-user Dexie + Vercel Clerk env fix
- Production 500 was `Missing publishableKey` — Clerk keys were only in `.env.local`; set on Vercel Production/Preview and redeployed.
- Each signed-in Clerk user now gets `AttendlyDB_u_<userId>` IndexedDB (no shared attendance across accounts on one browser). Legacy `AttendlyDB` migrates once to the first account that claims it.
- Files: `src/lib/db/database.ts`, `user-database-provider.tsx`, `app-providers.tsx`, `repository.ts` (`allTables()`).

### 2026-08-05 — Auth-required app (signed-out landing)
- **What:** App content now requires Clerk sign-in. `src/proxy.ts` uses `clerkMiddleware` + `createRouteMatcher` (protected-first): public `/`, `/sign-in`, `/sign-up`, `/__clerk`; everything else `auth.protect()` → redirect to landing. Signed-out `/` shows polished Attendly landing (brand, pitch, Sign in/Sign up modals, theme toggle, on-device note) — **no** Today shell/data. Signed-in `/` → `TodayScreen` (then `/onboarding` if Dexie settings not onboarded). App shell only when signed in. Removed optional onboarding auth prompt. Still Dexie-local after login (v1).
- **Files:** `src/proxy.ts`, `src/app/page.tsx`, `src/components/auth/landing-page.tsx`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`, `src/components/shell/{app-frame,clerk-auth-controls,side-nav,bottom-nav}.tsx`, `src/components/onboarding/onboarding-intro.tsx`, deleted `auth-prompt.tsx`, `.env.example`, `docs/UI-COMPONENT-MAP.md`, this journal.
- **Env:** existing Clerk keys + optional `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `SIGN_UP_URL`, `*_FALLBACK_REDIRECT_URL=/`.
- **Verify:** `npm run build`.
- **For user:** Signed out → landing only. Sign in → Today (or onboarding). Protected routes bounce to `/`.

### 2026-08-05 — Onboarding page + Clerk UI taste
- **What:** Front/onboarding (“Set your bar”) now reads as Clerk-aware without blocking Dexie-local setup. Bare top bar keeps centered theme toggle and shows Sign in / Sign up (`Show` + modal buttons) or `UserButton` when signed in. Auth-aware intro copy (local-on-device vs welcome + still local). Soft optional account prompt. Clerk modals/UserButton use Attendly teal via `attendlyClerkAppearance` (CSS vars track light/dark).
- **Files:** `src/app/onboarding/page.tsx`, `src/components/onboarding/{onboarding-intro,auth-prompt}.tsx`, `src/lib/clerk-appearance.ts`, `src/app/layout.tsx`, `src/components/shell/{app-frame,clerk-auth-controls}.tsx`, `docs/UI-COMPONENT-MAP.md`, this journal.
- **Verify:** `npm run build`.
- **For user:** Onboarding stays completable unsigned; Sign in is optional polish for later sync. *(Superseded: auth now required — see entry above.)*

### 2026-08-05 — Clerk auth (optional sign-in)
- **What:** Added `@clerk/nextjs` with modern App Router APIs. `src/proxy.ts` runs `clerkMiddleware()` (Next 16 filename; open by default so Dexie-local browsing still works unsigned). `ClerkProvider` wraps the app inside `<body>`. Shell chrome shows `<Show>` + SignIn/SignUp/UserButton (no SignedIn/SignedOut).
- **Files:** `src/proxy.ts`, `src/app/layout.tsx`, `src/components/shell/clerk-auth-controls.tsx`, `app-frame.tsx`, `side-nav.tsx`, `.env.example`, this journal.
- **Env:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` in `.env.local` (not committed). Copy from Clerk Dashboard API keys.
- **Verify:** `npm run build`.
- **For user:** Add keys → `npm run dev` → Sign up → UserButton in header/sidebar. *(Superseded: middleware now protects app routes.)*

### 2026-08-05 — Vercel deploy readiness check
- **Verdict:** **READY WITH CAVEATS** — `npm run test` (170) + `npm run build` pass; standard Next App Router (no `output: export`); AI routes `runtime = "nodejs"`; Dexie is client-only; secrets gitignored; no broken imports from deleted `week-preview` / share-code.
- **Env for Vercel:** `GROQ_API_KEY`, `GEMINI_API_KEY` (optional: `GEMINI_MODEL`, `GROQ_MODEL`, `GROQ_FALLBACK_MODEL`). App runs without keys; AI returns 503 + setup hint.
- **Caveats:** Per-browser IndexedDB (no cloud sync); schedule JSON export for friends (no marks); PDF for attendance summary; Groq/Gemini rate limits; large photo bodies can hit ~4.5MB serverless body limit; repo had no git commits at check time (commit+push before Git import); `npm run lint` has React purity noise but does **not** block `next build`.
- **Docs fix:** README Vercel/env/schedule-export section; `package.json` `engines.node >=20.9`; this entry.
- **Files:** `README.md`, `package.json`, this journal.
- **Verify:** `npm run test` · `npm run build`.

### 2026-08-05 — Coach subject report (schedule + marks)
- **What:** Tap a Coach subject card → **Subject report** sheet: name, % vs criteria, risk, bunks left; mini Present / Absent / OD / Left counts; week-grouped list of materialized sessions with **weekday, date, time, room**, and mark status (Present / Absent / Cancelled / Holiday / OD / Not marked). Same report opens from Subjects card tap. Uses Dexie sessions in semester range (after `ensureSessionsMaterialized`).
- **Files:** `subject-report.ts`, `subject-report-sheet.tsx`, `rule-cards.tsx`, `insights-page.tsx`, `subjects-page.tsx`, `subject-card.tsx`, unit test, `UI-COMPONENT-MAP.md`, this journal.
- **Verify:** `npm run test:unit -- test/unit/attendance/subject-report.test.ts` · `npm run build`.
- **For user:** Coach → tap any subject card → scroll the day-by-day schedule. Subjects page does the same.

### 2026-08-05 — Groq coach 8B rate-limit fallback
- **Problem:** Agent Control chat dumped raw Groq `429 rate_limit_exceeded` JSON when `llama-3.3-70b-versatile` hit TPD.
- **What:** Coach chat tries primary model, then **one retry** on 429/503 with `llama-3.1-8b-instant`. Env overrides: `GROQ_MODEL` / `GROQ_FALLBACK_MODEL`. Friendly `rate_limited` API error (no raw JSON). Bunk/standing questions fall back to local Dexie rule math when both models fail.
- **Files:** `groq-coach.ts`, `coach/route.ts`, `local-coach-fallback.ts`, `agent-control.tsx`, `use-coach-chat.ts`, `.env.example`, unit/API tests, this journal.
- **Verify:** `npm run test:unit -- test/unit/ai/groq-coach.test.ts test/unit/ai/local-coach-fallback.test.ts test/api/coach.test.ts` · `npm run build`.
- **For user:** Chat keeps working via 8B when 70B is rate-limited; if both fail, see a short “try again” note (and local bunk lines for “What can I bunk?”).

### 2026-08-05 — Dark theme contrast / elevation pass
- **Problem:** Dark mode was muddy — cards barely elevated, progress rings/codes dim, SAFE badges flat, and “Unmarked catch-up” kept light cream `--risk-watch-bg` (`#fff3de`) on a dark page.
- **What:** Remapped `html[data-theme="dark"]` tokens (deeper page, clearer raised/mist, brighter ink/mute, fill-safe teal brand, dark amber/green/red risk washes). Added `--ring-track` + `--shadow-card`. Standing cards/badges/rings, sidebar active rail, agenda meta, Agent sheet/FAB sheets, Card — theme-aware surfaces. Light tokens unchanged in spirit.
- **Files:** `globals.css`, `standing-hero.tsx`, `pct-ring.tsx`, `side-nav.tsx`, `theme-toggle.tsx`, `agenda-list.tsx`, `today-screen.tsx`, `card.tsx`, `agent-sheet.tsx`, `ai-fab.tsx`, `agent-control.tsx`, `ai-assistant-panel.tsx`, `quick-add-sheet.tsx`, `print-report.tsx`, `bottom-nav.tsx`, this journal.
- **Verify:** `npm run build`.
- **For user:** Toggle Dark — catch-up is dark amber, standing/agenda cards read clearly, light mode unchanged.

### 2026-08-05 — Extra Remove + unique Slot labels
- **Problem:** Extra / makeup Timetable cards only showed Insights + Move (no way to undo a mistaken Extra). Move period chips could show two “Slot 4” labels after `ensurePeriodSlotsCover` preserved an old label while inserting a new mid-day period.
- **What:** `removeExtraSession` hard-deletes Extra/one-off/substitution from Dexie (clears mark); Timetable **Remove** + confirm; Today agenda **Remove Extra**. Period chips always display `Slot ${index+1}`; merge/sync renumbers uniquely (times stay source of truth).
- **Files:** `move-session.ts`, `period-slots.ts`, `period-slot-chips.tsx`, `day-timetable.tsx`, `timetable-page.tsx`, `agenda-list.tsx`, `today-screen.tsx`, `day-agenda.tsx`, unit tests, this journal.
- **Verify:** `npm run test:unit -- test/unit/timetable/period-slots.test.ts test/unit/timetable/extra-session-visibility.test.ts` · `npm run build`.
- **For user:** Extra card → **Remove** → confirm. Move chips never duplicate Slot N.

### 2026-08-05 — Fix Add class extras missing on Timetable day list
- **Problem:** Extra / this-date-only classes wrote to Dexie (`addExtraSession` → `extra#<uuid>`), but Timetable filtered the day list with `occurrenceKey.split("#")[1] === selectedYmd`. That suffix is a UUID for extras, so they never matched and vanished from the list (Today was fine — it already validated YYYY-MM-DD).
- **What:** Shared `sessionLocalYmd()` in `dates.ts` (date suffix only when it looks like `YYYY-MM-DD`, else local `startsAt`). Timetable reload uses it; move + Today agenda share the helper. After this-date add, rematerialize that day then reload.
- **Files:** `dates.ts`, `timetable-page.tsx`, `move-session.ts`, `load-day-agenda.ts`, `test/unit/timetable/extra-session-visibility.test.ts`, this journal.
- **Verify:** `npm run test:unit -- test/unit/timetable/extra-session-visibility.test.ts` · `npm run build`.
- **For user:** Add class → This date only → class shows immediately on that day’s Timetable (and Today).

### 2026-08-05 — Fix Timetable card More menu
- **Problem:** Unified day cards showed a broken **More** popover — clipped by card `overflow-hidden`, often wrapping under Insights, and listing only duplicates of Insights / Move / Change / Cancel.
- **What:** Removed the redundant More dropdown. Primary row keeps **Insights · Move · Change · Cancel**; scope (This date / Every week) stays in those dialogs + the help line under the buttons.
- **Files:** `day-timetable.tsx`, this journal.
- **Verify:** `npm run build`.
- **For user:** No tiny misplaced More menu; all class actions stay on the visible button row.

### 2026-08-05 — Unified Timetable day view
- **Problem:** Timetable stacked two UIs (weekday permanent tabs + “This week / Day-to-day”) that felt duplicated; card actions were cramped/cut off.
- **What:** Single day-focused surface — date picker + ◀ ▶ (wraps within semester when set), weekday hint, materialized sessions for that date. Per-card **Insights / Move / Change / Cancel** open the same scope modals (**This date only** / **Every week**). Add class keeps two scopes. Outside-semester empty state links to Settings. Removed `week-preview.tsx` bottom block. Subject **name** first on cards; actions wrap on their own row (no cutoff).
- **Files:** `day-timetable.tsx` (new), `timetable-page.tsx`, `timetable-toolbar.tsx`, deleted `week-preview.tsx`, `UI-COMPONENT-MAP.md`, this journal.
- **Verify:** `npm run build`.
- **For user:** One Timetable — pick any calendar day; edit that day or the permanent weekly pattern from the same cards.

### 2026-08-05 — Full-semester materialize (fix Aug 3 cutoff)
- **Root cause:** Onboarding / blank autofill set `semesterStart` + series `effectiveFrom` to **Monday of the current week** (e.g. 2026-08-03). Import reused that via `ensureSemesterRange()` and never asked for real term dates. Materializer correctly skips `date < effectiveFrom`, so weeks before Aug 3 (and any day before that lock) stayed empty despite a permanent weekly pattern. Settings → Semester range existed but was buried under Daily periods.
- **What:**
  1. Settings: Semester range is its own prominent section; save still calls `applySemesterRange` (sync `effectiveFrom` → semester start + rematerialize full range).
  2. Onboarding: required semester start/end date fields.
  3. Import confirm: required semester start/end; saves via `applySemesterRange` then adds series with `effectiveFrom = semester start`; materializes start→end.
  4. Timetable empty weeks: callout + link to Settings when a weekly pattern exists but the week is empty / outside term.
  5. Unit test: start=2026-07-27 end=2026-12-15 → Jul 29 Wed + Aug Mon/Tue sessions; CT1 suppress still skips.
- **Files:** `ensure-materialized`, `semester-range-editor`, `settings/page`, `onboarding/page`, `import/preview-editor`, `week-preview`, `timetable-page`, `test/unit/timetable/semester-range-materialize.test.ts`, this journal.
- **Verify:** `npx vitest run test/unit/timetable/semester-range-materialize.test.ts` · `npm run build`.
- **For user:** Settings → Semester range → set real start (e.g. first teaching Monday) + end → **Save semester & rematerialize**. Then pick any week in Timetable / Today — classes appear from the weekly pattern (except CT/Exam/holiday blocks).

### 2026-08-05 — Standing fan: full subject names
- **Bug:** Today **Standing · per subject** cards truncated names to “Su..” / “Ele..” — `sm:grid-cols-2` inside a ~22rem rail left almost no width after the % ring.
- **What:** Container-query grid (`@container` + `@md:grid-cols-2`) so narrow rails stay **one column**; names use `line-clamp-2` (not `truncate`); Today rail widened to `minmax(18rem,26rem)`. Same name wrap on Coach `RuleCards` + Subjects `SubjectCard`. Code stays muted secondary.
- **Files:** `standing-hero.tsx`, `today-screen.tsx`, `rule-cards.tsx`, `subject-card.tsx`, this journal.
- **Verify:** `npm run build`.
- **For user:** Full names readable on phone and laptop; Analytics still fans to 2 cols when the section is wide.

### 2026-08-05 — Week preview: Day | Week views
- **Problem:** Day-to-day schedule showed all 7 days in a crowded grid; hard to edit one day’s classes.
- **What:** `WeekPreview` defaults to **Day** mode — Mon–Sun chip strip + ◀ ▶ wrap-around within the selected week (Mon↔Sun), focusing **Today** when that week is open. **Week** toggle restores the full overview. Preference stored in `localStorage` (`attendly.weekPreview.view`). Cards use `subjectPrimaryLabel` (name first). Original/permanent timetable above unchanged.
- **Files:** `week-preview.tsx`, this journal.
- **Verify:** `npm run build`.
- **For user:** Day = one day at a time with room to Move/Change/Cancel; Week = full grid. Arrows loop through the week.

### 2026-08-05 — Period chips: free/taken + correct preselect
- **Bugs / UX:** (1) Edit/Move pre-selected **Slot 1** when series times (10:30 / 16:20) weren’t in Settings defaults. (2) Add class only showed a red conflict *after* picking a taken period.
- **What:**
  1. `matchPeriodSlotIndex` — exact / same-start only; **never** silent Slot 1. `ensurePeriodSlotsCover` + `resolvePeriodChipsForTimes` sync missing times into Settings (replace stock defaults when untouched). Import save syncs too.
  2. `getPeriodSlotsOccupancy` — free vs taken for probe day; own session/series excluded on Edit/Move. Taken chips grayed with **Taken · {subject name}**; `title` tooltip “Name · start–end”; tap taken flashes “Already going on…”.
  3. Wired on **Add / Edit / Move** (+ makeup). Edit title prefers subject **name**.
- **Files:** `period-slots.ts`, `slot-overlap.ts`, `period-slot-chips.tsx`, `use-period-occupancy.ts`, `quick-add-sheet`, `edit-slot-dialog`, `move-class-dialog`, `makeup-prompt`, `preview-editor`, tests, this journal.
- **Verify:** `npx vitest run test/unit/timetable/period-slots.test.ts test/unit/timetable/slot-overlap.test.ts` · `npm run build`.

### 2026-08-05 — UX overhaul: per-subject standing, Agent popup, name-first
- **Problem:** Tall mark pills + half-page Agent docks; Standing used overall %; Analytics was dense streaks/patterns/table; codes (CS402) dominated over full names.
- **What:**
  1. **Standing** = per-subject fan (each vs own 75%+buffer).
  2. **Marking** = compact horizontal P/A/C/H/OD; Move/Ask as text links.
  3. **Agent** = FAB/pill → full-viewport sheet on Today/Analytics/Coach; Chat|Agent kept; scrollable history; no Agent-mode spam in chat.
  4. **Analytics** = 2–3 key points + subject fan + PDF (no weekday table / patterns wall / embedded agent).
  5. **Coach** = insight cards full width + same Agent sheet.
  6. **Week cards** compact menu; scopes aligned to **This date only** / **Every week (permanent)**.
  7. **Name-first labels** across agenda, standing, timetable, subjects, insights, PDF, dialogs; shortCode muted secondary.
  8. Sidebar footer mentions PDF (not JSON).
- **Files:** `standing-hero`, `mark-actions`, `agenda-list`, `agent-sheet`, `agent-control`, `ai-dock`, `today-screen`, `analytics-page`, `insights-page`/`rule-cards`, `week-preview`, `slot-list`, `subject-card`, `load-subject-standings`, `scope-copy`, `subject-label`, `attendance-report(-html)`, `side-nav`, this journal.
- **Verify:** `npm run build`.
- **For user:** Standing is per class vs 75%. Agent is a button → full-screen. Analytics is short summary + subject grid. Titles show full subject names.

### 2026-08-05 — Slots-only + overlap block + semester/CT + two-scope
- **Hard rule:** No custom time for class add/move/edit/makeup/agent — period chips only (Settings → Daily periods edits times).
- **Overlap:** `findDaySlotOverlaps` soft-blocks double-booking same date + overlapping period (Move, Add, makeup, Agent actions).
- **Two scopes:** `MutationScopeRadios` — **This date only** | **Every week** on Move, Edit, Cancel, Add.
- **Semester + CT/Exam:** Settings → Semester range (`applySemesterRange`) + calendar kinds CT1/CT2/Exam/exam week/holiday/break (suppress teaching).
- **Empty weeks / Mon–Tue:** Repair mid-week semester start; saving semester range backdates series `effectiveFrom` and rematerializes full term.
- **Files:** `period-slot-chips`, `mutation-scope-radios`, `slot-overlap`, `ensure-materialized`, dialogs, settings editors, `actions.ts`, `agent-flows.ts`, tests, this journal.
- **Verify:** custom-time search · vitest timetable · `npm run build`.
- **For user:** Settings → semester start/end (early enough for past weeks) → CT/Exam blocks → Timetable weeks fill from permanent pattern. Conflicts show a clear alert.

### 2026-08-05 — Fix Mon/Tue empty week + Move class period chips
- **Root cause (Mon/Tue):** Onboarding and blank-semester autofill set `semesterStart` / series `effectiveFrom` to **today**. When that landed mid-week (e.g. Wed Aug 5), the materializer correctly skipped Mon/Tue of that week (`date < effectiveFrom`), so This week showed “No classes” even with permanent Mon/Tue slots. Not a timezone/week-start filter bug.
- **What:**
  1. Autofill + onboarding use **Monday of the current week** (`mondayOfWeekYmd`).
  2. `repairMidWeekSemesterStart` — if semester starts Tue–Sun and permanent series exist on earlier weekdays, snap `semesterStart` + matching `effectiveFrom` back to that Monday (runs inside `resolveMaterializeRange` / ensure).
  3. Empty week columns: **Add to weekly pattern** opens quick-add with that day selected.
  4. **Move class** dialog loads Settings `periodSlots` chips (times auto-fill); custom time is secondary expand — same pattern as Timetable Add class.
- **Files:** `src/lib/dates.ts`, `src/lib/timetable/{ensure-materialized,index}.ts`, `src/app/onboarding/page.tsx`, `src/components/timetable/{move-class-dialog,week-preview,timetable-page}.tsx`, `test/unit/timetable/midweek-semester.test.ts`, this journal.
- **Verify:** `npx vitest run test/unit/timetable/midweek-semester.test.ts` + `npm run build`.
- **For user:** Reload Timetable / Today — Mon/Tue of this week rematerialize if they exist in Original. Move class shows period chips. Empty days can add via the column button.

### 2026-08-05 — Schedule export/import (no marks) in Settings
- **What:** Re-added Settings **Export / Import schedule** — JSON dump of settings, subjects, weekly series, exceptions, calendar blocks, and session rows. **Attendance marks are never exported or imported** (friend gets a clean slate). Confirm before destructive replace; rematerialize after import; PDF summary stays separate. Backup schema v2 (`scope: "schedule"`); v1 files still import with marks ignored.
- **Files:** `src/lib/db/{export-import,types,index}.ts`, `src/components/settings/schedule-backup-panel.tsx`, `src/app/settings/page.tsx`, `test/unit/db/export-import.test.ts`, `test/integration/attendance-flow.test.ts`, this journal.
- **DB future:** Yes — today Dexie full structure dump; later with cloud auth/DB, export/import remains a portable backup between accounts or offline; cloud sync is separate.
- **Verify:** `npx vitest run test/unit/db/export-import.test.ts test/integration/attendance-flow.test.ts` + `npm run build`.
- **For user:** Settings → Export schedule & settings (no marks) / Import schedule & settings.

### 2026-08-05 — Agent Control: Chat default + Agent walkthroughs
- **Problem:** Every message (hi / what can u do / ok) was hijacked into guided walkthroughs; users wanted normal grounded chat *and* agentic flows.
- **What:**
  1. Default **Chat** mode → Groq coach with `allowActions: false`; casual/capability/advice messages never start local flows.
  2. **Agent** toggle + chips (Add subject/class, Set holiday, …) or clear mutative NL → guided Dexie walkthroughs / Groq actions.
  3. Mid-guide questions pause the flow, answer in chat, offer **Continue setup**; **Exit guide** returns to Chat.
  4. Tightened `detectFlowIntent` (no bare “holiday”; no chat-only hijacks); prompts/pageContext chat-first.
- **Files:** `src/components/ai/agent-control.tsx`, `src/lib/ai/{agent-flows,prompts,page-ai-config}.ts`, `test/unit/ai/actions.test.ts`, this journal.
- **Verify:** `npx vitest run test/unit/ai/actions.test.ts` + `npm run build`.
- **For user:** Today/Coach/Analytics → Chat for Q&A; tap Agent or a chip to change data.

### 2026-08-05 — Removed share-code / JSON backup UI; PDF-only export
- **What:** Deleted all user-facing share-code and JSON backup export/import (Settings cards, Import Advanced tabs, `ShareCodePanel`, `JsonImport`, `share-code.ts`). Sole data-out path is **Download attendance PDF** (print → Save as PDF) on Settings, Analytics, and Today.
- **Files:** `src/app/settings/page.tsx`, `src/components/import/import-page.tsx`, `src/components/{analytics/{analytics-page,print-report},today/{today-screen,empty-hub}}.tsx`; deleted `share-code-panel.tsx`, `json-import.tsx`, `share-code.ts`; `test/unit/ux/b8-b11.test.ts`; this journal. Lib `export-import.ts` kept for tests/internal only.
- **Verify:** `npm run build`.
- **For user:** No Export/Import JSON or share codes. Use **Download attendance PDF** for a full summary.

### 2026-08-05 — Agent Control walkthroughs execute Dexie actions
- **Problem:** Coach chat only advised; users still had to use forms for add/delete/mark/cancel/move.
- **What:**
  1. Shared action contract in `src/lib/ai/actions.ts` (Zod + `executeAttendlyAction`) — also used by UI move/delete.
  2. **Agent Control** on **Today / Coach / Analytics** only: guided chips (add subject → name → short code → color → Confirm → Dexie), plus Groq `allowActions` JSON when key present.
  3. Destructive ops (`deleteSubject`, `deleteSession`) show confirm chips; other actions auto-run with “Done: …” status.
  4. Other tabs stay insight-popup-only (no FAB chat) — coordinates with UI strip.
- **Files:** `src/lib/ai/{actions,agent-flows,prompts,groq-coach,schemas,page-ai-config}.ts`, `src/components/ai/{agent-control,action-runner,insight-popup}.tsx`, `src/components/{today/ai-dock,insights/insights-page,analytics/analytics-page,shell/app-frame}.tsx`, `src/app/api/ai/coach/route.ts`, `test/unit/ai/actions.test.ts`, this journal.
- **Verify:** `npx vitest run test/unit/ai/actions.test.ts` + `npm run build` + `npm test`.
- **For user — add a subject via agent:** Today/Coach → “Add subject” → type name → tap suggested short code → pick/skip color → **Confirm** → Done: added ….

### 2026-08-05 — AI only on Today / Coach / Analytics; insight popup elsewhere
- **Problem:** Ask-AI FAB / page chat cards on Timetable, Subjects, Calendar, Import, Plan, Settings felt empty and spammy.
- **What:**
  1. **Full Agent Control (chat)** only on **Today** (dock), **Coach** (`/insights`), and **Analytics**.
  2. Stripped shell FAB + page-level Ask AI cards from other routes.
  3. **Subjects / Timetable / Calendar:** tap subject or class → **InsightPopup** (local cards: %, bunks, risk, skip next?, tip) — no chat box. Optional “Ask more on Coach →”.
  4. `requestFocus(..., { ui: "insight" | "coach" })` — insight default; Today class ask uses coach.
- **Files:** `src/lib/ai/{page-ai-config,ai-focus,load-subject-focus}.ts`, `src/components/ai/{insight-popup,ai-focus-context,agent-control}.tsx`, `src/components/{shell/app-frame,subjects/*,timetable/{slot-list,week-preview,timetable-page},today/{day-agenda,agenda-list,today-screen,ai-dock},analytics/*,insights/*}.tsx`, this journal.
- **Verify:** `npm run build`.
- **For user:** Chat lives on Today / Coach / Analytics. Everywhere else, tap a subject or class for a focused insight sheet.

### 2026-08-05 — Cancel → delete + Move / reschedule class
- **What:** After cancelling, **Delete cancelled class** (confirm) hard-clears that occurrence via `seriesExceptions` type `deleted` (materializer skips forever). **Move class…** (“Move this class to…”) picks date + start/end (+ room); same day → `modified` exception; other day → hide original + one-off on target; optional permanent weekly rewrite. Wired on Today, Day agenda, Timetable week preview. Shared: `deleteCancelledOccurrence` / `moveSessionOccurrence` + chat actions `deleteSession` / `moveSession` / `rescheduleSession` in `src/lib/ai/actions.ts`.
- **Files:** `src/lib/timetable/move-session.ts`, `materialize-sessions.ts`; `src/lib/db/types.ts`; `src/lib/ai/actions.ts`; `src/components/timetable/{move-class-dialog,week-preview,timetable-page}.tsx`; `src/components/today/{agenda-list,day-agenda,today-screen}.tsx`; `src/lib/today-types.ts`, `load-day-agenda.ts`; `test/unit/timetable/move-delete.test.ts`; this journal.
- **Verify:** `npx vitest run test/unit/timetable/move-delete.test.ts` + `npm run build`
- **How to use:** Cancel (C or Week preview) → **Delete cancelled class** → confirm. Move: **Move class…** → day + times → Move (or update permanent).

### 2026-08-05 — Fixed daily period slots (college template)
- **Problem:** Adding a class forced typing start/end every time.
- **What:**
  1. **Settings.periodSlots** — default 6 slots (09:00–10:00 … 15:00–16:00, labels Slot 1…6). Older Dexie rows get defaults via `getSettings` merge.
  2. **Settings → Daily periods** editor — change count/labels/times once; save to Dexie.
  3. **Timetable quick-add** — subject → day → **tap a period chip** (shows range) → Save. Optional collapsed **Custom time** for odd timings. Creates master weekly series with those times (master vs week-only edit flow unchanged).
  4. **Chat `addWeeklySlot`** — optional `slotIndex` resolves times from Settings via `timesFromSlotIndex` (start/end still allowed). Coach stats expose `periodSlots` with `slotIndex`.
- **Files:** `src/lib/db/{types,repository,index}.ts`, `src/lib/timetable/{period-slots,index}.ts`, `src/components/settings/daily-periods-editor.tsx`, `src/app/settings/page.tsx`, `src/components/timetable/{quick-add-sheet,timetable-page}.tsx`, `src/lib/ai/{actions,build-coach-stats,page-ai-config}.ts`, `test/unit/timetable/period-slots.test.ts`, this journal.
- **Verify:** `npm run build` (+ period-slots unit test).
- **For user:** Settings → Daily periods (once) → Timetable → Add class → pick subject, day, period chip.

### 2026-08-05 — AI co-pilot: subject click → instant insights
- **Problem:** Ask AI on every tab felt empty — blank chat, no value until you typed.
- **What:**
  1. **Subjects:** tap a subject card → opens/focuses AI panel with **instant local insight cards** (bunks, risk, skip next?, pattern) + auto `POST /api/ai/coach` digest for that subject (`pageContext` + subjectId/stats). Follow-up chat still available.
  2. **Today / Calendar day agenda:** expanded class row → **Ask AI: Should I attend this?** one-tap session insight.
  3. **Pre-filled prompt chips** (3–4) on every page’s AI panel from `page-ai-config` (e.g. Subjects: “Which subject is most at risk?”, Calendar: “Summarize this day”).
  4. Shared `AiFocusProvider` + FAB sheet open on focus; desktop inline card only mounts ≥md (no double fetch).
  5. Graceful without `GROQ_API_KEY` — local cards still show; setup hint explains coach needs the key.
- **Files:** `src/lib/ai/ai-focus.ts`, `src/components/ai/{ai-focus-context,subject-insight-cards,ai-assistant-panel,ai-fab,page-ai-card}.tsx`, `src/hooks/use-coach-chat.ts`, `src/lib/ai/{page-ai-config,build-coach-stats}.ts`, `src/components/{subjects/*,today/{agenda-list,ai-dock,today-screen,day-agenda},shell/app-providers}.tsx`, `test/unit/ai/ai-focus.test.ts`, this journal.
- **Verify:** `npm run build` (+ `ai-focus` unit test).
- **For user:** Subjects → tap a card → AI opens with answers, not a blank box.

### 2026-08-05 — Safe-bunk insights use term-bounded Rem
- **What:** Fixed forward-looking bunk planning. UI was showing only historical % / infinite-horizon `classesYouCanSkip` (often **0** early at 100% with small T) and hardcoding `remainingClasses = 0`. Now Rem = upcoming countable sessions until semester end; Today / Subjects / Plan / Insights show lines like `100% · can bunk 5 more (of 20 left)` or `Attend 3 of next 12 to recover`. Hint when Rem=0. Recalculates after every mark via Dexie reload.
- **Files:** `src/lib/attendance/{bunk-math,bunk-insight,types,index}.ts`, `src/lib/today/load-day-agenda.ts`, `src/components/{today/standing-hero,today/today-screen,subjects/*,insights/*,plan/semester-projection}.tsx`, `src/lib/ai/build-coach-stats.ts`, `src/lib/analytics/attendance-report.ts`, `src/lib/notifications/sync.ts`, `test/unit/attendance/{bunk-math,bunk-insight}.test.ts`
- **For user:** At 100% with future classes left you still see how many you can bunk this term — not just a Safe badge.

### 2026-08-05 — Timetable edit places: permanent vs today-only
- **Problem:** Week view still offered “entire weekly pattern / all weeks” as a peer edit option, so students could rewrite the semester from a day-to-day change by mistake.
- **What:** Two clear places on `/timetable`:
  1. **Original / permanent timetable** (top) — only place for all-weeks edits. Label: changes apply to every week. Button: **Edit permanent**. Delete asks confirm.
  2. **This week’s timetable** (below) — day-to-day. **Change this date** defaults to this-date-only (optional: this and following weeks). No primary “edit all weeks.” Secondary link: **Change permanent schedule** → jumps to Original. Cancel is this-date-only; permanent remove is a secondary link to Original delete.
- **Kept:** Delete confirmations; master `entire_pattern` edits rematerialize future sessions; today-only exceptions leave master unchanged.
- **Files:** `src/components/timetable/{timetable-page,slot-list,week-preview,edit-slot-dialog,cancel-scope-dialog}.tsx`, UI map + this entry.
- **For user:** Permanent = top **Original / permanent timetable**. Today-only = week section → **Change this date** → save this date only.

### 2026-08-05 — Remove subject (cascade delete)
- **What:** Subjects page can permanently remove a subject. Confirm dialog warns that weekly slots, all past/future classes for that subject, and their attendance marks are deleted. Cascade lives in `deleteSubject`; UI rematerializes afterward so Timetable master pattern drops those slots.
- **Files:** `src/lib/db/repository.ts`, `src/components/subjects/{subjects-page,subject-card}.tsx`, `test/unit/db/delete-subject.test.ts`
- **For user:** Open **Subjects** → **Remove subject** on a card → confirm → subject and its timetable/attendance data are gone.

### 2026-08-05 — Fix cancel class + holiday (persist + rematerialize)
- **Broken:**
  1. Today/Calendar **Cancelled** / **Holiday** only `putSession`’d status. `loadDayAgenda` always rematerializes → wiped the mark (looked like a no-op).
  2. Timetable mid-refactor: toolbar dropped Cancel today, but page still passed old props; **Week preview / CancelScopeDialog existed but were not mounted** → cancel UI unreachable / typecheck fail.
  3. Settings/Plan calendar blocks called bare `materializeSessions()` (throws if semester blank) and swallowed errors → holiday saved but sessions stayed.
- **Fixed:**
  - Cancel → `cancelSessionOccurrence` / `seriesExceptions` + rematerialize; undo deletes the exception.
  - Holiday (Today H or Calendar **Mark day holiday**) → one-day `calendarBlocks` blackout via `markDateAsHoliday` + rematerialize; Today shows holiday empty state; clear one-day holiday supported.
  - Wired Timetable **Week preview** + Cancel scope (this date vs remove from pattern) + edit scopes; master pattern editor unchanged.
  - Calendar blocks editor uses `ensureSessionsMaterialized` with clear success/error.
- **Files:** `src/lib/today/load-day-agenda.ts`, `src/lib/timetable/{holiday-day,materialize-sessions,index}.ts`, `src/lib/db/repository.ts`, `src/components/{timetable/timetable-page,settings/calendar-blocks-editor,today/today-screen,today/day-agenda}.tsx`, `test/unit/timetable/cancel-holiday.test.ts`, this journal.
- **Verify:** `npm run test` (cancel-holiday + suite) + `npm run build`
- **How to use:** Cancel one class — Today → open class → **C**, or Timetable → Week preview → **Cancel…** → this date only. Holiday — Today → **H** (whole day), Calendar → **Mark day holiday**, or Plan/Settings → Exam weeks & holidays range.

### 2026-08-05 — Timetable master pattern vs week preview (mental model)
- **Problem:** Timetable felt like a single-week snapshot; users could not tell where the original repeating schedule lived or what a today-only change did to next week.
- **What:** Split `/timetable` into two clear sections:
  1. **Weekly pattern (master)** — primary, above the fold. Edits Dexie `timetableSeries`. Title: “Repeats every week — this is your real timetable.” Note that next week+ use the same pattern unless a one-day exception is added. Edit = all weeks; delete asks confirm (“Delete this class from your weekly timetable? This cannot be undone.”).
  2. **Week preview** — this / next / pick week. Shows materialized `classSessions` with badges “From weekly pattern” vs “One-day change”. Change… offers this date only / this and following weeks / entire pattern. Cancel… offers this date only vs remove from pattern forever. Extra/makeup stay one-day only.
- **Logic:** `applySeriesEdit` / `applySeriesCancel` in `edit-series-scope.ts` (exception · series split · master update · delete). Never silently mutates master on a today-only edit.
- **Files:** `src/lib/timetable/edit-series-scope.ts`, `src/components/timetable/{timetable-page,week-preview,slot-list,day-chips,timetable-toolbar,edit-slot-dialog,cancel-scope-dialog,confirm-dialog}.tsx`, `test/unit/timetable/edit-series-scope.test.ts`, UI map + this entry.
- **Verify:** `npm run test` (edit-scope + manual timetable) + `npm run build` green.
- **For user:** Original timetable = top **Weekly pattern** card. Today-only changes = **Week preview** → Change… → “Change only this date.”

### 2026-08-05 — Simplified Import + full PDF attendance report
- **What:** Import is one clean page (photo primary; file/JSON/share collapsed under Advanced). Full printable PDF report from Dexie only — overall standing, every subject (%, P/A/OD, bunks/recovery, target), weekly series pattern, day-by-day history (semester range, last 90 days capped for print). Browser print → Save as PDF (no jspdf).
- **Entry points:** Analytics sidebar **Download PDF report** / **Print report**; Settings **PDF attendance report**; Today under standing hero.
- **Files:** `src/components/import/import-page.tsx`; `src/lib/analytics/attendance-report.ts`, `attendance-report-html.ts`; `src/components/analytics/{print-report,analytics-page}.tsx`; Settings + Today wired; `test/unit/analytics/attendance-report.test.ts`; this journal.
- **Verify:** `npm run test` + `npm run build`

### 2026-08-05 — Fix theme toggle overlapping Attendly brand
- **What:** Side nav stacked brand on its own row and put light/dark/system `ThemeToggle` on the next full-width row (`justify-between`) so the compact control no longer covers the “y” in Attendly. Mobile top bar keeps brand left / toggle right with `shrink-0` + truncate. Unblocked build by dropping duplicate local `todayYmd` in timetable page (use `@/lib/dates`).
- **Files:** `src/components/shell/side-nav.tsx`, `theme-toggle.tsx`, `app-frame.tsx`; `src/components/timetable/timetable-page.tsx`
- **Verify:** `npm run build`

### 2026-08-05 — Day picker + shell theme + AI on every tab
- **What:** Day-by-day agenda on Today & Calendar (prev/next + date pick, mark/change from Dexie). Shell light/dark/system `ThemeToggle` (Dexie `settings.theme`; a11y prefs untouched). Shared AI panel/FAB + `pageContext` on coach API for every main route.
- **Day view:** `DayNavigator`, `DayAgenda`, `loadDayAgenda`; Today supports `/?date=YYYY-MM-DD` (keeps `/?action=mark-next`). Calendar month tap opens same day detail.
- **Theme:** Compact toggle in mobile top bar + side nav; full toggle in Settings Display section (alongside high contrast / reduced motion / large taps).
- **AI:** `useCoachChat` → `POST /api/ai/coach` with optional `pageContext`. Shell FAB on Timetable/Subjects/Calendar/Import/Plan/Analytics/Settings; Today dock + Insights full chat unchanged; onboarding tip only.
- **Files:** `src/lib/dates.ts`, `src/lib/today/load-day-agenda.ts`, `src/components/{calendar/day-navigator,today/day-agenda,shell/theme-toggle,ai/*}.tsx`, shell/pages wired
- **Verify:** `npm run test` (107) + `npm run build` green

### 2026-08-05 — UX polish B8–B11 (practical subset)
- **What:** Deep link `/?action=mark-next` focuses next unmarked Today class + PWA manifest shortcuts; `/analytics` streaks & weekday pattern cards from real Dexie marks + print/PDF report; Settings theme / high-contrast / reduced-motion / larger taps (Dexie-persisted); timetable `ATTENDLY1.` share codes; import preview confidence / missing-field highlights. No fake attendance.
- **Verify:** `npm run test` (100) + `npm run build` green (`/analytics` route).
- **Files:**
  - `src/lib/analytics/patterns.ts`, `src/components/analytics/**`, `src/app/analytics/page.tsx`
  - `src/lib/onboarding/share-code.ts`, `src/components/onboarding/share-code-panel.tsx`
  - Settings a11y + `app-providers` + `globals.css` data attrs; types a11y fields
  - `today-screen.tsx` deep link, `agenda-list.tsx` scroll ids, `public/manifest.webmanifest`
  - `preview-confidence.ts`, `preview-editor.tsx`; Import Share code tab
  - `test/unit/ux/b8-b11.test.ts`; `docs/future-improvements.md` B8–B11 checked

### 2026-08-05 — Parallel feature lanes integrated
- **What:** Merged bunk planning, smarter timetable, local notifications, analytics/UX, and AI v2 onto the responsive shell without reverting Today (side nav + AI dock) or Gemini 429→Groq vision. Nav includes `/analytics`. Settings retains **Notifications** section (A7). Manual timetable add fills semester bounds + materializes.
- **Verify:** `npm run test` (94) + `npm run build` green.
- **Docs:** `future-improvements.md` Done vs Still later + integration snapshot; UI map analytics/plan/settings routes; this entry.

### 2026-08-05 — Manual add UX unblocked end-to-end
- **Root cause:** Pure manual entry failed because (1) no obvious subject-create path on Timetable, (2) add form dead-ended when subjects were empty, (3) materialize often never ran / semester dates were blank so Today stayed empty. Import was the only reliable path.
- **What:** Prominent **Add subject** / **Add class** + `quick-add-sheet` (inline subject → day chips → time → save); `ensure-materialized` persists missing semester bounds; materialize after save; guided empty steps; edit/delete; success/error banners; Mark all present on Today; Mon–Sat working-days toggle in Settings. Coordinates with A6 (parity/makeup/ICS kept).
- **Files:** `src/lib/timetable/ensure-materialized.ts`, `src/components/timetable/{timetable-page,quick-add-sheet,add-subject-form,empty-guide,slot-list,timetable-toolbar}.tsx`, `src/components/today/today-screen.tsx`, `src/components/subjects/subjects-page.tsx`, `src/app/{onboarding,settings}/page.tsx`, `test/integration/manual-timetable.test.ts`
- **Verify:** `npm run test` (94) + `npm run build` green.
- **For user:** Timetable → Add subject → Add class → see grid → Today for sessions. No Gemini needed.

### 2026-08-05 — Attendance intelligence (A5)
- **What:** Semester-end projection (exam/holiday blackouts via `calendarBlocks.suppressesTeaching`), safe-week planner (`/plan` + `/plan/safe-week`), per-component targets (subject `componentTargets` + series `sessionType` / optional `targetPct`). Existing bunk-math API extended — not replaced. Personal Dexie only; no Clerk / seed data.
- **Math:** `resolveCollegeTargetPct` (series → component → subject → settings); `projectSemesterEnd` / `countRemainingClasses`; `safeWeekImpact` / `sessionsInDateRange`. Materializer already skipped suppressed days; Settings + Plan UI add/remove blocks and rematerialize.
- **UI:** Plan page sections (bunk sim, safe week, projection, blackouts); Settings calendar-blocks editor; Subjects component-target editor; Timetable slot type + optional slot target %.
- **Tests:** `test/unit/attendance/projection.test.ts`
- **Files:**
  - `src/lib/attendance/{projection,safe-week,targets,index}.ts`
  - `src/lib/db/types.ts` (+ `AttendanceComponent`, `componentTargets`, series `targetPct`)
  - `src/components/plan/{plan-page,safe-week-planner,safe-week-page,semester-projection}.tsx`
  - `src/components/settings/calendar-blocks-editor.tsx`
  - `src/components/subjects/{component-targets-form,subject-card}.tsx`
  - `src/app/plan/safe-week/page.tsx`, settings/plan/timetable/subjects wiring
  - `docs/future-improvements.md` (A5 marked done)
- **For user:** Add exam weeks in Settings or Plan → projection ignores them; pick a travel range on Plan → see per-subject % drop; set Lab 90% on a subject or slot.

### 2026-08-05 — Smarter timetable (A6): parity, makeup, file import, ICS
- **What:** Personal Dexie-only smarter timetable. Fixed **manual add subject + slot** (Timetable quick-add can create subject inline; Subjects add form; `ensureSessionsMaterialized` after add/copy/import). Series `weekParity: all|odd|even` via ISO week in materializer. Cancel today → optional makeup with `replacesSessionId` + `relevance: makeup`. Import Excel/CSV (SheetJS) + PDF text with Groq/Gemini text parse (`POST /api/ai/parse-timetable-text`). One-way Google Calendar via `.ics`. Kept copy day / quick-add / cancel / extra.
- **Verify:** `test/unit/timetable/*`; `npm run build`.
- **Files:** `src/lib/db/types.ts`, `repository.ts`; `src/lib/timetable/**`; `src/lib/ai/parse-timetable-text.ts`, `prompts.ts`; `src/app/api/ai/parse-timetable-text/route.ts`; `src/components/timetable/*`; `src/components/import/{file-import,import-page,preview-editor}.tsx`; `test/unit/timetable/*`; `future-improvements.md` §6; this journal. Dep: `xlsx`.

### 2026-08-05 — AI upgrades B12–B14 (coach v2, import v2, local-first)
- **What:** Groq coach v2 — `mode` chat/digest/plan, voice-style default, structured `plan` JSON, optional `policyResearch` → `groq/compound` (OFF by default; never for % math). Gemini import v2 — richer parse prompt (messy/handwriting/portal), room + faculty fields, **diff merge vs full replace** apply. Local-first — `GET /api/ai/status`; missing keys → `503` + `setupHint`; bunk math/UI keep working; coach/import show setup banners. Insights desktop coach polished (sticky column, mode chips, plan cards).
- **Preserved:** Gemini 429 retry/model chain, Groq vision `qwen/qwen3.6-27b` fallback, `quota_exceeded` API shape + Import watch banner.
- **Files:**
  - `src/lib/ai/{schemas,prompts,groq-coach,diff-import,ai-status,json-text,build-coach-stats}.ts` (gemini retry path untouched; prompts upgraded)
  - `src/app/api/ai/{coach,parse-timetable,status}/route.ts`
  - `src/components/insights/{coach-chat,insights-page}.tsx`
  - `src/components/import/{photo-import,preview-editor,import-page}.tsx`
  - Tests: `test/unit/ai/{diff-import,groq-coach,schemas,routes}.test.ts`, `test/api/{coach,parse-timetable,status}.test.ts`
  - Docs: this journal + `docs/future-improvements.md` (B12–B14 marked done)
- **Env:** keys from `.env.local` / Vercel only — never committed.
- **Verify:** `npm run test` + `npm run build`.

### 2026-08-05 — Cursor plugins / MCP recommendation guide
- **What:** Added research guide for Attendly-relevant Cursor Marketplace plugins and MCPs (Vercel, Clerk, Supabase/Neon, Redis, Resend, OneSignal, etc.): prioritized table, auth/DB fit, phase order, agent-vs-human setup, and explicit “do not add yet” for Dexie-only v1.
- **Files:** `docs/PLUGINS-RECOMMENDED.md`; links from `docs/future-improvements.md`, this journal
- **For user:** Read [PLUGINS-RECOMMENDED.md](./PLUGINS-RECOMMENDED.md) before enabling cloud auth/DB; optional now: authenticate Vercel/Clerk/Supabase MCPs in Cursor Settings without wiring them into the app.

### 2026-08-05 — PWA local notifications (A7)
- **What:** Client-only local notifications (no push server). Settings: enable + request permission, T−15/T−5 pre-class, post-class mark nudge, critical when bunk buffer ≤ 1. Prefs on Dexie `settings`. Today syncs timers from today’s sessions; SW `public/sw.js` shows notifications when registered.
- **Graceful:** Permission denied / unsupported → no throw; reminders only while the tab/PWA can run timers.
- **Files:**
  - `src/lib/notifications/**` — permission, plan, scheduler, sync, SW register, Today hook
  - `src/lib/db/types.ts` + `repository.getSettings` merge for new notify fields
  - `src/app/settings/page.tsx` — toggles
  - `src/components/today/today-screen.tsx` — hook + resync after load/mark
  - `public/sw.js` — notificationclick → focus app
  - `test/unit/notifications/plan.test.ts`
  - Docs: `future-improvements.md` A7 checked; this journal entry

### 2026-08-05 — Gemini 429 resilience + Groq vision fallback
- **What:** Photo timetable parse now retries Gemini 429s (honors `retryDelay` once, capped ~50s; short 2s/5s backoff if delay is huge), walks a model fallback chain (`GEMINI_MODEL` optional, then `gemini-2.0-flash` → `gemini-2.5-flash` → `gemini-1.5-flash` / `-latest` / `gemini-flash-latest`), and on persistent quota uses Groq multimodal `qwen/qwen3.6-27b`. API returns structured `quota_exceeded` + `retryAfterSeconds` + hint (no raw Google RPC dumps). Import UI shows a friendly watch banner; success via Groq shows a soft “Parsed via Groq backup” note.
- **Files:** `src/lib/ai/gemini-timetable.ts`, `src/app/api/ai/parse-timetable/route.ts`, `src/components/import/{photo-import,import-page}.tsx`, `.env.example`, `test/unit/ai/gemini-timetable.test.ts`, `test/api/parse-timetable.test.ts`, `docs/IMPLEMENTATION-JOURNAL.md`
- **Env:** `GEMINI_API_KEY`, optional `GEMINI_MODEL`, `GROQ_API_KEY` (backup vision). Did not touch `.env.local`.
- **Verify:** `npm run test` (49) and `npm run build` green.
- **For user:** Retry photo import (may wait briefly on rate limit). If Gemini free tier is empty, Groq backup runs when `GROQ_API_KEY` is set. Otherwise wait ~retry seconds or add timetable manually / JSON tab.

### 2026-08-05 — Responsive redesign landed (map implemented)
- **What:** Implemented [UI-COMPONENT-MAP.md](./UI-COMPONENT-MAP.md). Dropped permanent `max-w-lg` phone cage. Mobile: bottom nav + single column + coach drawer. Desktop `md+`: side nav + ~1200px frame; Today 2–3 cols (standing | agenda | AI coach dock). Rich empty hubs with real CTAs — **no fake attendance**.
- **AI:** `CoachChat` always on; `buildCoachStats()` sends Dexie zeros + note when empty → `POST /api/ai/coach`. Clear error if `GROQ_API_KEY` missing.
- **Verify:** `npm run build` + `npm run test` (42) green. Laptop ≥768px = side rail + wide Today; phone = bottom tabs + Ask AI sheet.
- **Files:**
  - Shell: `src/components/shell/{app-frame,side-nav,bottom-nav,nav-config,page-shell}.tsx`
  - Today: `empty-hub`, `ai-dock`, `standing-hero`, `today-screen`, `agenda-list`
  - Insights: `coach-chat`, `insights-page` · `src/lib/ai/build-coach-stats.ts`
  - Shared UI: `src/components/ui/{button,card,empty-hub,page-header,pct-ring}.tsx`
  - Widened: subjects, timetable, calendar, import, plan, settings · `globals.css`
  - Docs: map checklist checked; this journal entry

### 2026-08-05 — UI component map for responsive redesign
- **What:** Added target architecture doc for the laptop + phone redesign: breakpoints, shell (side nav / bottom nav / frame), Today (risk, agenda, mark actions, empty hub, AI dock), all feature screens, and shared primitives. No fake attendance data — empty hubs with real CTAs only.
- **Files:** `docs/UI-COMPONENT-MAP.md`, `docs/IMPLEMENTATION-JOURNAL.md` (Related docs link)
- **For user:** Read [UI-COMPONENT-MAP.md](./UI-COMPONENT-MAP.md) to see how the redesigned UI is organized; redesign agent implements against it.

### 2026-08-05 — Attendly v1 ready
- **What:** Personal Dexie-only Attendly is runnable end-to-end under `src/`. Root layout wraps all routes in `AppFrame` + bottom nav (hidden on onboarding). Feature pages, Today ritual, AI routes, bunk math, and tests are integrated. No Clerk / cloud DB / seed data.
- **Verify:** `npm run test` and `npm run build` both green.
- **How to run:** `npm install && npm run dev` — optional `.env.local` with `GROQ_API_KEY` / `GEMINI_API_KEY`. Deploy to Vercel with the same env vars; marks stay in browser IndexedDB.
- **Files:** `src/app/layout.tsx`, `src/app/**/page.tsx`, `README.md`, `docs/IMPLEMENTATION-JOURNAL.md`, `test/**`

### 2026-08-05 — UI shell + Today / onboarding / settings (Attendly)
- **What:** Mobile-first Attendly shell with Fraunces + DM Sans, daylight traffic-light tokens, bottom nav. Today / onboarding / settings are client Dexie-backed — **no demo subjects, fake agenda, sample quotes, or mock attendance**. Empty states until the user (or AI import) adds real data.
- **UX:**
  - Today — risk banner (or “No attendance yet”), agenda checklist from today’s `classSessions`, thumb-zone Present/Absent/Cancelled/Holiday/On Duty + undo, impact line from `@/lib/attendance`, unmarked catch-up for ended classes
  - Onboarding — criteria 75/80/85, semester label, buffer → `saveSettings({ onboarded: true })`
  - Settings — live criteria readout; Export/Import JSON via `exportBackupJson` / `importBackupJson`
- **Files:**
  - `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
  - `src/app/onboarding/page.tsx`, `src/app/settings/page.tsx`
  - `src/components/shell/{app-frame,bottom-nav}.tsx`
  - `src/components/today/{today-screen,risk-banner,mark-actions,agenda-list}.tsx`
  - `src/lib/today-types.ts`, `src/lib/utils/cn.ts`
- **Deploy:** Normal Next.js App Router app (Vercel-ready); attendance stays in browser IndexedDB. `'use client'` wherever Dexie is touched.
- **For user:** `npm run dev` → onboarding once → empty Today until timetable/import.

### 2026-08-05 — Vitest suite under `test/` (unit + integration + mocked AI)
- **What:** Centralized tests in `test/`. Moved `src/lib/attendance/bunk-math.test.ts` → `test/unit/attendance/`. Integration covers empty Dexie → settings → subject/series → materialize → mark → standing → export/import (fake-indexeddb). AI route handlers mocked — no real API keys. Manual browser list in `test/E2E-CHECKLIST.md`.
- **How to run:** `npm run test` (all); `npm run test:unit` / `test:integration` / `test:api`
- **Files:**
  - `test/setup.ts` — `fake-indexeddb/auto`
  - `test/unit/attendance/bunk-math.test.ts` — bunk/recovery/risk/OD
  - `test/unit/ai/schemas.test.ts` — Zod + image normalize
  - `test/integration/attendance-flow.test.ts` — full business flow
  - `test/api/{parse-timetable,coach}.test.ts` — Route Handlers with vi.mock
  - `test/E2E-CHECKLIST.md` — onboarding, Today, import, insights, Vercel env
  - `vitest.config.ts` — include `test/**/*.test.ts` only
  - `package.json` — `fake-indexeddb` + scoped test scripts
- **For user:** `npm run test` should be green; use E2E checklist after deploy.

### 2026-08-05 — Feature pages lane (timetable / subjects / calendar / import / insights / plan)
- **What:** Client-only App Router pages + feature folders. All lists from Dexie or AI APIs — **no mock slots, fake subjects, sample insights, or hardcoded quotes**. Empty states when the user has no data yet.
- **Routes:** `/timetable`, `/subjects`, `/calendar`, `/import`, `/insights`, `/plan`
- **Behavior:**
  - Timetable — day chips, add slot, copy day, cancel today, extra class, now-glow on current slot
  - Subjects — % rings/bars + bunk/recovery via `@/lib/attendance` from real marks
  - Calendar — month grid with status dots from sessions + attendance + holiday blocks
  - Import — photo → `POST /api/ai/parse-timetable` → editable preview → save via repo; JSON restore via `importBackupJson`
  - Insights — rule cards computed from Dexie standings; coach chat → `POST /api/ai/coach` with live stats JSON
  - Plan — bunk simulator (extra skips + next-class impact) from real subject counts
- **Files:**
  - `src/app/{timetable,subjects,calendar,import,insights,plan}/page.tsx`
  - `src/components/timetable/{timetable-page,day-chips,slot-list,quick-add-sheet,add-subject-form,empty-guide,timetable-toolbar}.tsx`
  - `src/components/subjects/{subjects-page,subject-card,pct-ring}.tsx`
  - `src/components/calendar/{calendar-page,month-grid}.tsx`
  - `src/components/import/{import-page,photo-import,preview-editor,json-import}.tsx`
  - `src/components/insights/{insights-page,rule-cards,coach-chat}.tsx`
  - `src/components/plan/{plan-page,bunk-simulator}.tsx`
- **For user:** Mobile traffic-light UI wired to on-device Dexie; usable empty until you import/mark.

### 2026-08-05 — Dexie DB + timetable materializer (`src/lib/db`, `src/lib/timetable`)
- **What:** On-device IndexedDB layer for Attendly. Fresh install stays **empty** (no `populate`, no `seed.ts`, no demo subjects/sessions). CRUD + JSON backup; weekly series expand into `classSessions` via upsert on `occurrenceKey`. Marked sessions are never deleted (cancel/void instead).
- **How storage works:** Browser Dexie DB `AttendlyDB` → tables `settings`, `subjects`, `timetableSeries`, `seriesExceptions`, `calendarBlocks`, `classSessions`, `attendanceRecords`. Settings singleton `id=1` via `defaultSettings()` only when read (not written until save). Series = plan; sessions = reality; attendance FKs `sessionId`. Holidays via `calendarBlocks.suppressesTeaching`. Export/import = full JSON snapshot (`exportBackup` / `importBackup`; aliases `exportAll` / `importAll` for storage-bridge).
- **Named files:**
  - `src/lib/db/types.ts` — domain types (string UUID ids)
  - `src/lib/db/database.ts` — Dexie schema (no seed hooks)
  - `src/lib/db/repository.ts` — CRUD helpers
  - `src/lib/db/export-import.ts` — JSON backup restore
  - `src/lib/db/subject-palette.ts` — fixed subject colors
  - `src/lib/db/index.ts` — barrel
  - `src/lib/timetable/materialize-sessions.ts` — expand / cancel / modify / extra
  - `src/lib/timetable/index.ts` — barrel
- **Files:** above + this journal

### 2026-08-05 — Path unification: all app code under `src/`
- **What:** Moved attendance math from repo-root `lib/attendance/**` into `src/lib/attendance/**` so it matches the Next.js `src/app` scaffold. `@/` → `./src/*`. Vitest include is `src/**/*.test.ts` only. AI stays at `src/lib/ai` + `src/app/api/ai/*`.
- **Files:** `src/lib/attendance/*`, `vitest.config.ts`, `docs/IMPLEMENTATION-JOURNAL.md`
- **For user:** Imports are `@/lib/attendance` from UI; no dual root/`src` split.

### 2026-08-05 — No mock data — user + AI only
- **What:** Confirmed rule: no seed subjects, fake attendance, lorem, or pretend semesters. Empty states instruct; defaults are criteria presets the user picks. DSA/OS Lab may appear only in unit-test assertions or AI prompt *examples*, never as live UI data.
- **Files:** `docs/IMPLEMENTATION-JOURNAL.md`
- **For user:** Everything on screen is from your marks/settings/imports or real Gemini/Groq output.

### 2026-08-05 — Login/sessions/cloud DB explicitly deferred — later phase
- **What:** No Clerk, Postgres, Mongo, Redis, or cloud sync in v1. See `docs/future-improvements.md`.
- **Files:** `docs/IMPLEMENTATION-JOURNAL.md`

### 2026-08-05 — Attendance bunk/recovery/risk math (`lib/attendance`)
- **What:** Deterministic bunk engine: percentage, skippable, recovery, term-bounded can-skip/must-attend, Safe/Warning/Critical risk, next-class impact line, OD/cancelled exclusion pure functions. Vitest coverage in `lib/attendance/bunk-math.test.ts`. Extended vitest `include` to `lib/**/*.test.ts`.
- **Named files:**
  - `types.ts` — mark/session/OD/risk/standing types
  - `bunk-math.ts` — `calculatePercentage`, `classesYouCanSkip`, `classesToRecover`, `canSkipThisTerm`, `mustAttendThisTerm`, `calculateSubjectStanding`, `effectiveTargetPct`
  - `risk.ts` — `riskBand`
  - `impact.ts` — `nextClassImpact`, `impactLine`, `formatPct`
  - `session-counting.ts` — `sessionCountsTowardAttendance`, `isExcludedSessionStatus`, `markContribution`, `countAttendanceFromMarks`
  - `index.ts` — public barrel
- **How it works:** `% = A/T×100`; effective target = college min + buffer; skip = `floor(A/p − T)`; recovery = `ceil((p·T − A)/(1−p))`; term math clamps to remaining classes; cancelled/holiday out of denominator; OD/excused default `exclude` (does not lower % like Absent).
- **Files:** `lib/attendance/*`, `vitest.config.ts`, `docs/IMPLEMENTATION-JOURNAL.md`

### 2026-08-05 — AI API lane (Gemini parse + Groq coach)
- **What:** Vercel-deployable Next.js Route Handlers (Node runtime, no Express): timetable photo → Zod-validated subjects/slots; grounded coach chat that must not invent numbers. Keys only via `process.env`.
- **Files:**
  - `src/lib/ai/schemas.ts` — Zod schemas (parse result, coach request/response)
  - `src/lib/ai/prompts.ts` — Gemini + Groq prompts
  - `src/lib/ai/gemini-timetable.ts` — Gemini vision (`gemini-2.0-flash`)
  - `src/lib/ai/groq-coach.ts` — Groq chat (`llama-3.3-70b-versatile`)
  - `src/app/api/ai/parse-timetable/route.ts` — `POST` JSON base64 or multipart `image`/`file`
  - `src/app/api/ai/coach/route.ts` — `POST` `{ stats, message }` → `{ reply }`
- **Env:** `GEMINI_API_KEY`, `GROQ_API_KEY` (`.env.local` / Vercel project env; clear 500 if missing). Did not touch `.env.local`.
- **Deps:** `zod`, `@google/generative-ai`, `groq-sdk`.

### 2026-08-05 — Code style + Attendly branding standards
- **What:** Documented simplicity rules, feature-grouped naming, Attendly product name; set `package.json` name to `attendly`. Parallel v1 build continues under these standards.
- **Files:** `docs/IMPLEMENTATION-JOURNAL.md`, `package.json`
- **For user:** Codebase stays readable and orchestration-friendly; UI shows **Attendly**.

### 2026-08-05 — Journal created
- **What:** Started this living implementation journal per user request.
- **Files:** `docs/IMPLEMENTATION-JOURNAL.md`
- **Notes:** Next.js App Router under `src/app/`; Dexie / Groq / Gemini / Zod / Vitest deps present.

---

## Key files map

| Area | Path | Purpose |
|------|------|---------|
| Plan | `docs/AI-attendance-system-plan.md` | Product plan (v1) |
| UI map | `docs/UI-COMPONENT-MAP.md` | Target responsive UI: every component, desktop vs mobile |
| Future | `docs/future-improvements.md` | Later ideas (do not build in v1) |
| Journal | `docs/IMPLEMENTATION-JOURNAL.md` | This file |
| Types | `src/lib/db/types.ts` | Domain types (string UUID ids); empty `defaultSettings()` |
| Dexie schema | `src/lib/db/database.ts` | Per-user `AttendlyDB_u_<clerkId>` — 7 stores; offline cache |
| Cloud sync | `src/lib/db/cloud-sync.ts` | Client pull/push; `syncAfterBind`; required push for import |
| Supabase admin | `src/lib/supabase/admin.ts` | Service-role client (server only) |
| Supabase mappers | `src/lib/supabase/mappers.ts` | camelCase Dexie ↔ snake_case Postgres |
| Supabase sync | `src/lib/supabase/sync-server.ts` | `pullCloudSnapshot` / `pushCloudSnapshot` by `clerk_user_id` |
| Sync API | `src/app/api/sync/route.ts` | `GET` pull / `PUT` push; Clerk `auth()` + service role |
| Repository | `src/lib/db/repository.ts` | CRUD + debounced cloud push after writes |
| Schedule backup | `src/lib/db/export-import.ts` + Settings panel | Structure JSON (no marks); import → Dexie **then required Supabase push** |
| Palette | `src/lib/db/subject-palette.ts` | Fixed subject colors |
| Materializer | `src/lib/timetable/materialize-sessions.ts` | Series → sessions; weekParity; cancel/modify/extra/makeup |
| Holiday day | `src/lib/timetable/holiday-day.ts` | One-day `calendarBlocks` blackout + rematerialize |
| Day agenda | `src/lib/today/load-day-agenda.ts` | Load/mark Today; cancel via exceptions; holiday via blocks |
| Timetable helpers | `src/lib/timetable/{week-parity,ensure-materialized,parse-*,export-ics,edit-series-scope}.ts` | ISO parity, rematerialize, CSV/Excel/PDF, ICS, edit/cancel scopes |
| Math | `src/lib/attendance/` | %, bunks, recovery, risk, impact, OD exclusions, projection, safe-week, component targets, `formatBunkInsight` |
| Subject report | `src/lib/attendance/subject-report.ts` + `subject-report-sheet.tsx` | Per-subject week-grouped schedule + marks for Coach/Subjects |
| Bunk insight | `src/lib/attendance/bunk-insight.ts` | Term-bounded copy: “can bunk N of Rem” / “Attend M of next Rem” |
| Projection | `src/lib/attendance/projection.ts` | Semester-end % / safe bunks; blackout-aware remaining |
| Safe week | `src/lib/attendance/safe-week.ts` | Miss-range per-subject impact |
| Targets | `src/lib/attendance/targets.ts` | `resolveCollegeTargetPct` priority chain |
| AI focus | `src/lib/ai/ai-focus.ts` + `src/components/ai/ai-focus-context.tsx` | Subject/session focus → insight cards + auto coach digest |
| AI schemas | `src/lib/ai/schemas.ts` | Zod for timetable parse + coach I/O (modes, plan, faculty) |
| AI prompts | `src/lib/ai/prompts.ts` | Gemini v2 + grounded coach digest/plan/policy |
| Diff import | `src/lib/ai/diff-import.ts` | Slot diff vs replace plan for preview confirm |
| AI status | `src/lib/ai/ai-status.ts` | Local-first key flags + setup hint |
| Gemini helper | `src/lib/ai/gemini-timetable.ts` | Vision parse; retries/model chain; Groq vision fallback; `GEMINI_API_KEY` / `GEMINI_MODEL` |
| Groq helper | `src/lib/ai/groq-coach.ts` | Coach chat; primary `GROQ_MODEL` (70B) + one 429/503 retry via `GROQ_FALLBACK_MODEL` (8B); optional `groq/compound` |
| Local coach fallback | `src/lib/ai/local-coach-fallback.ts` | Rule-based bunk/standing digest when Groq rate-limited |
| Parse API | `src/app/api/ai/parse-timetable/route.ts` | `POST /api/ai/parse-timetable` |
| Text parse API | `src/app/api/ai/parse-timetable-text/route.ts` | `POST` plain text/PDF extract → subjects/slots |
| Coach API | `src/app/api/ai/coach/route.ts` | `POST /api/ai/coach` |
| AI status API | `src/app/api/ai/status/route.ts` | `GET /api/ai/status` |
| Shell | `src/components/shell/`, `src/app/layout.tsx`, `src/app/globals.css` | Signed-in frame: side nav `md+`, bottom nav mobile, theme toggle, UserButton; bare when signed out |
| Clerk proxy | `src/proxy.ts` | `clerkMiddleware` + `createRouteMatcher`; public `/`, `/sign-in`, `/sign-up`, `/__clerk`; else `auth.protect()` → `/` |
| Landing | `src/components/auth/landing-page.tsx`, `src/app/page.tsx` | Signed-out front page; signed-in mounts `TodayScreen` via `auth()` |
| Sign-in / Sign-up | `src/app/sign-in/[[...sign-in]]/`, `src/app/sign-up/[[...sign-up]]/` | Clerk `<SignIn />` / `<SignUp />` → redirect `/` |
| Clerk UI | `src/components/shell/clerk-auth-controls.tsx`, `src/lib/clerk-appearance.ts` | `<Show>` + UserButton (shell); SignIn/SignUp on landing; Attendly teal appearance |
| Shared AI | `src/components/ai/`, `src/hooks/use-coach-chat.ts`, `src/lib/ai/page-ai-config.ts` | Panel / FAB / page cards + pageContext |
| Day agenda | `src/lib/dates.ts`, `src/lib/today/load-day-agenda.ts`, `day-navigator`, `day-agenda` | Any-day class list + marks |
| Shared UI | `src/components/ui/` | Button, card, empty-hub, page-header, pct-ring re-export |
| Coach stats | `src/lib/ai/build-coach-stats.ts` | Dexie → grounded JSON for Groq (zeros OK) |
| Today UI | `src/app/page.tsx`, `src/components/today/` | Standing hero, empty hub, agenda, mark actions, AI dock |
| Notifications | `src/lib/notifications/` | Local Notification API + optional SW; schedule from Today |
| Service worker | `public/sw.js` | Show/click local notifications (no push) |
| Onboarding | `src/app/onboarding/page.tsx`, `src/components/onboarding/` | Auth-required; criteria / semester / buffer → Dexie |
| Settings UI | `src/app/settings/page.tsx` | Criteria + a11y + notifications + Summary PDF + schedule backup + Daily periods |
| Daily periods editor | `src/components/settings/daily-periods-editor.tsx` | Edit fixed college slot template (`Settings.periodSlots`) |
| Period slot helpers | `src/lib/timetable/period-slots.ts` | Normalize / resolve `slotIndex` → times |
| Timetable UI | `src/app/timetable/`, `src/components/timetable/day-timetable.tsx` | Single day picker; Move/Change/Cancel scopes; quick-add; ICS |
| Subjects UI | `src/app/subjects/`, `src/components/subjects/` | Manual add, remove (cascade), rings, bunks; tap → subject report sheet |
| Calendar UI | `src/app/calendar/`, `src/components/calendar/` | Month status dots |
| Import UI | `src/app/import/`, `src/components/import/` | Photo primary; Advanced = Excel/CSV/PDF file; preview confirm |
| Insights UI | `src/app/insights/`, `src/components/insights/` | Rule cards + Groq coach |
| Analytics UI | `src/app/analytics/`, `src/components/analytics/`, `src/lib/analytics/{patterns,attendance-report*}.ts` | Streaks, patterns, Summary PDF |
| Preview hints | `src/lib/import/preview-confidence.ts` | Confidence / missing-field highlights |
| Plan UI | `src/app/plan/`, `src/components/plan/` | Bunk sim, safe-week, semester projection |
| Calendar blocks UI | `src/components/settings/calendar-blocks-editor.tsx` | Exam week / holiday ranges (Settings + Plan) |
| Pages | `src/app/**/page.tsx` | Route entry points |
| Env | `.env.example` | Clerk + AI + `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` |
| Tests | `test/` | Vitest: unit / integration / mocked AI; `E2E-CHECKLIST.md` |

---

## Architecture snapshot

```
Attendly PWA (Clerk sign-in required for app)
  Clerk: ClerkProvider + proxy.ts protect (landing public; app routes auth)
  Identity: clerk_user_id scopes all cloud rows + Dexie DB name

  Cloud (source of truth when online)
    Supabase Postgres project attendly (wulbivagfngyzreoefwo, ap-south-1)
      tables: settings | subjects | timetable_series | series_exceptions
              calendar_blocks | class_sessions | attendance_records
      RLS on; no anon/authenticated policies
      Server: service role via getSupabaseAdmin() — never in browser

  Offline cache (read-through)
    Dexie AttendlyDB_u_<clerkUserId> (7 stores mirroring cloud)

  Sync (cloud-first)
    UserDatabaseProvider → bindDatabaseForUser → syncAfterBind (pull + merge → Dexie)
    markAttendance / saveSettings / deleteSubject → syncCriticalToCloud (await push)
    Other repository mutations → scheduleCloudPush (debounced)
    Settings Import schedule JSON → importBackup → Dexie + rematerialize
      → pushLocalToCloud({ required: true })  // Import → cloud (throws on fail)
    GET /api/sync  ← pull   (auth().userId)
    PUT /api/sync  → push   (auth().userId + full CloudSnapshot)

  UI / domain (unchanged consumers of Dexie)
    Today / Timetable / Subjects / Calendar / Analytics / Plan / Import / Settings
    materializeSessions → classSessions
    Rules engine (src/lib/attendance)
    Schedule backup JSON = portable structure (no marks); cloud sync is separate path
    POST /api/ai/* → Groq/Gemini; GET /api/ai/status
```

### Cloud DB architecture (detail)

| Concern | Choice |
|--------|--------|
| Host | Supabase Postgres (`https://wulbivagfngyzreoefwo.supabase.co`) |
| Tenant key | `clerk_user_id` on every table (composite PK with row `id` except settings PK = user) |
| AuthZ | Clerk on Next.js API; service role bypasses RLS; filter every query by `userId` |
| Client keys | `NEXT_PUBLIC_SUPABASE_URL` + anon key only (optional); **service role server-only** |
| Conflict | Full-snapshot replace per user on push; merge on bind (cloud wins ties; attendance newer markedAt wins) |
| Import path | Dexie write → required Supabase push of schedule+settings+sessions (marks cleared) |
| Offline | Dexie read cache; critical writes require cloud (throw if unreachable) |

- **Storage:** Supabase Postgres (cloud) + Dexie (cache). **No demo seed.**
- **Host:** Vercel — app + `/api/sync` + AI routes (`runtime = "nodejs"`); secrets from `process.env`.
- **Live:** https://attendly-navy.vercel.app · GitHub `gpr-27/attendly`

---

## How to run

```bash
npm install
npm run dev
npm run test          # all Vitest suites
npm run test:unit     # bunk math + AI schemas
npm run test:integration
npm run test:api      # mocked Gemini/Groq routes
```

Env: `.env.local` with `GROQ_API_KEY`, `GEMINI_API_KEY`, Clerk keys, Supabase URL/anon/service-role, and Clerk redirect URLs (gitignored). See `.env.example`. Never overwrite `.env.local` secrets. Manual UI checks: `test/E2E-CHECKLIST.md`.

## 2026-08-05 — Push & Vercel production deploy

- Initial commit `4556704` pushed to `https://github.com/gpr-27/attendly` (`main`).
- Vercel project **attendly** created under team `praneethg1830-7293s-projects`, GitHub repo connected.
- Production live: https://attendly-navy.vercel.app
- Dashboard: https://vercel.com/praneethg1830-7293s-projects/attendly
- Env (Production + Preview): AI keys, Clerk keys, and Supabase `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Redeploy after adding keys.

## 2026-08-06 — Fix attendance marks lost on reload (cloud sync)

**Root cause:** On every sign-in / page reload, `syncAfterBind` pulled the cloud snapshot and **replaced** local Dexie wholesale. Marks are only pushed on an 800ms debounce, so rapid marking or reload-before-push left cloud stale. Worse, `flushCloudPush` waited for an in-flight push then **returned without pushing again**, dropping marks that landed mid-push.

**Fix:**
- `mergeSnapshots()` unions attendance by `sessionId` (newer `markedAt` wins) and keeps referenced sessions.
- `syncAfterBind` merges remote + local instead of blind overwrite; pushes merged attendance when local had unsynced marks.
- `flushCloudPush` loops until debounced work is drained (no early return after in-flight).
- `registerCloudPushLifecycle()` flushes on `pagehide` / tab hide.

**Tests:** `test/unit/db/cloud-sync.test.ts` (merge + bind + flush). `npm run test:unit` + `npm run build` pass.

## 2026-08-06 — Cloud-first production architecture

**Goal:** Supabase is authoritative for all attendance data; Dexie is a read-through cache only.

**Before:** Every repository write went to Dexie first; cloud sync was debounced (800ms). Local could win on timestamp ties during merge. Marks/settings could exist only on-device until debounce fired.

**After:**
- **Write path:** `markAttendance`, `clearAttendance`, `saveSettings`, and `deleteSubject` call `syncCriticalToCloud()` — await push to `/api/sync` before returning; throw `CloudSyncError` on failure so UI can retry.
- **Read path:** `syncAfterBind` pulls cloud first, merges unsynced local attendance (newer `markedAt` wins), hydrates Dexie. New `pullCloudToLocal()` for explicit cloud → cache hydration.
- **Merge:** `mergeSnapshots` tie-breaks favor cloud (remote wins when `updatedAt` equal).
- **Bulk writes** (subjects, series, materialize, import): still debounced via `scheduleCloudPush`; import keeps required push.

**Dexie still used for:** fast UI reads, offline read cache, legacy DB migration on first bind. Groups feature remains Supabase-only (unchanged).

**Tests:** extended `test/unit/db/cloud-sync.test.ts` (cloud-wins tie, immediate mark push, pullCloudToLocal).

## 2026-08-06 — Optimistic UI for chat + attendance marks

**Goal:** Tap Send / mark Present-Absent feels instant on slow Android phones (WhatsApp-style). Network sync runs in background; no blocking spinners on normal send/mark actions.

**Group chat (`group-chat.tsx`):**
- Optimistic message append with `pending-*` temp id before POST; input clears immediately.
- Background POST replaces temp row with server message on success; failure removes bubble, restores draft, shows retry link.
- Double-send prevented via 400ms debounce ref — Send button never shows loading state.

**Attendance marks (`repository.ts`, `today-screen.tsx`, `day-agenda.tsx`, `mark-actions.tsx`):**
- `markAttendance` / `clearAttendance` use debounced `scheduleCloudPush()` instead of blocking `syncCriticalToCloud()`.
- Today / Day agenda update item status in React state synchronously on tap; Dexie write + `refresh()` run after (refresh not awaited for UI).
- Mark buttons get `active:scale-95` touch feedback.

**AI Coach + Agent Control (`coach-chat.tsx`, `agent-control.tsx`):**
- User bubble appears before API round-trip; typing indicator while waiting.
- Composer stays enabled during assistant response; 400ms send debounce prevents double-tap only.
- Removed send-button spinner; `active:scale-95` on send.

**Cloud sync:** merge-snapshot logic unchanged; `saveSettings` / `deleteSubject` still await critical push. Lifecycle flush on tab hide still pushes pending marks.

**Tests:** `markAttendance cloud push` test expects debounced push (0 immediate, 1 after `flushCloudPush`).
