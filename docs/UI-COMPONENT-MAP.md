# Attendly UI Component Map (Responsive Redesign)

**Status:** Implemented (2026-08-05). Living map — update if paths diverge.  
**Rule:** No fake attendance data. Empty screens are rich hubs with real CTAs — never demo subjects or sample marks.  
**Related:** [Implementation Journal](./IMPLEMENTATION-JOURNAL.md) · [Product plan](./AI-attendance-system-plan.md)

Use this doc to see **how the UI is organized**: every planned component, its file, its job, and how it behaves on phone vs laptop.

---

## 1. Layout breakpoints

| Breakpoint | Width | Shell | Content layout |
|---|---|---|---|
| **Mobile** | `< 768px` (`max-md`) | Bottom nav, no side rail | Single column; mark actions sit in the thumb zone above the nav |
| **Laptop / desktop** | `≥ 768px` (`md:`) | Side nav (primary); bottom nav hidden | Wide frame, max ~`1200px` centered with padding — **not** a skinny phone column |

**Today on desktop** uses a **2–3 column grid**:

1. Risk / standing summary  
2. Agenda + mark actions  
3. AI coach dock (always visible or pinned)

**Today on mobile** stacks the same pieces vertically; AI coach opens as a drawer/sheet from a CTA, not a permanent third column.

**CSS tokens** (in `src/app/globals.css`): `--nav-h`, `--thumb-zone`, traffic-light risk colors, brand/surface washes. Frame width is driven by `AppFrame`, not a hard `max-w-lg` phone cage on desktop.

---

## 2. Shell components

| File | Purpose | Desktop (`md+`) | Mobile (`<md`) |
|---|---|---|---|
| `src/components/shell/app-frame.tsx` | App chrome when **signed in**; bare wrapper when signed out or on onboarding / sign-in / sign-up | Side + main row; content `max-w-[1200px]` centered | Full-width column; sticky brand + theme; bottom padding for `--nav-h` |
| `src/components/shell/side-nav.tsx` | Primary navigation rail (Attendly brand + links + theme toggle + UserButton) | Visible vertical rail: Today … Settings + theme | Hidden |
| `src/components/shell/bottom-nav.tsx` | Thumb-reach tab bar | Hidden | Fixed bottom tabs; hidden on bare routes |
| `src/components/shell/clerk-auth-controls.tsx` | `<Show>` + UserButton (signed-in); Sign in/up fallback | Side nav footer | Mobile header |
| `src/components/auth/landing-page.tsx` | Signed-out front page: brand, pitch, Sign in/up, theme toggle | Centered column | Same |
| `src/components/shell/app-providers.tsx` | Dexie theme + a11y → `html` `data-theme` / `.dark` + a11y data attrs | Same | Same |
| `src/components/shell/theme-toggle.tsx` | Light / dark / system → `settings.theme` | Compact in side nav header | Compact in mobile top bar; full in Settings |

**Nav notes**

- **Auth gate:** `src/proxy.ts` protects all routes except `/`, `/sign-in`, `/sign-up`, `/__clerk`. Unsigned users never see the app shell or attendance data.
- Onboarding / sign-in / sign-up are **bare**: no side nav, no bottom nav.
- Secondary routes (Calendar, Import, Plan) live in the **side nav** on desktop; on mobile they are reachable from Today empty-hub CTAs, Settings, or Insights — not every tab must crowd the bottom bar.  
- Active route styling uses pathname prefixes (`/` exact for Today when signed in).

---

## 3. Today (home ritual)

Route: `/` → signed-out: `LandingPage`; signed-in: `TodayScreen` (`auth()` in `page.tsx`).

| File | Purpose | Desktop | Mobile |
|---|---|---|---|
| `src/components/today/today-screen.tsx` | Orchestrates Dexie load, onboarding redirect, risk + agenda + empty/AI regions | 2–3 column grid | Single column stack |
| `src/components/today/risk-banner.tsx` | Traffic-light standing: Safe / Warning / Critical + % or “No attendance yet” | Large summary card in left/top column | Full-width banner under header |
| `src/components/today/agenda-list.tsx` | Today’s `classSessions` checklist (now/next, unmarked catch-up) | Middle column list | Main scroll list |
| `src/components/today/mark-actions.tsx` | Present / Absent / Cancelled / Holiday / On Duty + undo + impact line | Inline under selected agenda row (comfortable hit targets) | Fixed/sticky **thumb zone** above bottom nav |
| `src/components/today/empty-hub.tsx` | Rich empty state when no timetable/sessions yet — **CTA hub**, not a sad blank | Multi-CTA panel spanning grid | Full-bleed hub with pattern/wash background |
| `src/components/today/ai-dock.tsx` | Groq coach panel wired to live Dexie stats (zeros OK when empty) | Persistent side column / dock | Drawer or sheet opened from hub / header CTA |
| `src/components/calendar/day-navigator.tsx` | Prev / next / date picker for any YYYY-MM-DD | Inline under Today or Calendar headers | Same |
| `src/components/today/day-agenda.tsx` | Shared day class list + mark/change (Dexie) | Used under Calendar detail; Today uses AgendaList directly with same loader | Same |
| `src/components/ai/{ai-assistant-panel,ai-fab,page-ai-card}.tsx` | Shared coach UI + mobile FAB + page Ask AI card | Page cards on most routes; Insights full chat | FAB via shell where `shellFab` |

**Empty-hub CTAs (real links only)**

- Set up timetable → `/timetable`  
- Import photo → `/import`  
- Ask AI coach → opens AI dock / `/insights`  
- Open settings → `/settings`  
- Plan bunks → `/plan` (optional secondary)

**Data rule:** Risk, agenda, and coach stats come only from Dexie (or honest zeros). No sample classes.

---

## 4. Feature screens

### Timetable — `/timetable`

**Mental model:** One day-focused surface. Pick any calendar date → see materialized `classSessions` for that day. Mutations use **This date only** vs **Every week (permanent)** on Move / Change / Cancel / Add. Permanent weekly pattern (`timetableSeries`) is edited via the Every week scope, not a separate stacked section.

| File | Purpose | Desktop | Mobile |
|---|---|---|---|
| `src/components/timetable/timetable-page.tsx` | Orchestrates day view + dialogs | Single day card above fold | Same; date controls wrap |
| `src/components/timetable/day-timetable.tsx` | Date picker + ◀ ▶; session cards with Insights / Move / Change / Cancel | Comfortable cards, wrapping actions | Same; actions wrap full width |
| `src/components/timetable/edit-slot-dialog.tsx` | Change with This date / Every week scopes | Modal | Bottom sheet–style modal |
| `src/components/timetable/move-class-dialog.tsx` | Move with period chips + scope | Modal | Modal |
| `src/components/timetable/cancel-scope-dialog.tsx` | Cancel this date only or every week | Modal | Modal |
| `src/components/timetable/confirm-dialog.tsx` | Destructive confirm before delete cancelled | Modal | Modal |
| `src/components/timetable/timetable-toolbar.tsx` | Add class / copy weekday pattern / export .ics | Button group | Wrap |
| `src/components/timetable/quick-add-sheet.tsx` | Add with This date / Every week + period chips | Sheet | Sheet |

### Subjects — `/subjects`

| File | Purpose | Desktop | Mobile |
|---|---|---|---|
| `src/components/subjects/subjects-page.tsx` | Subject standings from real marks | Responsive card grid (2–3 cols) | Single column cards |
| `src/components/subjects/subject-card.tsx` | Name, color, bunk/recovery copy | Larger card with ring + stats | Compact card, ring + short lines |
| `src/components/subjects/pct-ring.tsx` | Traffic-light % ring (shared visual) | Larger ring | Smaller ring, still readable |

Empty: hub CTA to add timetable / import — never fake subject rows.

### Calendar — `/calendar`

| File | Purpose | Desktop | Mobile |
|---|---|---|---|
| `src/components/calendar/calendar-page.tsx` | Month scan + holiday blocks | Centered month with side detail optional | Full-width month |
| `src/components/calendar/month-grid.tsx` | Day cells with status dots from sessions + attendance | Larger cells, hover affordance | Compact grid, tap for day detail |

### Import — `/import`

| File | Purpose | Desktop | Mobile |
|---|---|---|---|
| `src/components/import/import-page.tsx` | Photo + JSON restore entry | Two-column: photo \| JSON | Stacked sections |
| `src/components/import/photo-import.tsx` | Capture/upload → `POST /api/ai/parse-timetable` | Drag-drop + file picker | Camera / file picker |
| `src/components/import/preview-editor.tsx` | Editable Gemini preview before save to Dexie | Wide editable table | Scrollable stacked edits |
| `src/components/import/json-import.tsx` | Restore via `importBackupJson` | Side-by-side with export tip | Simple file + confirm |

### Insights / AI chat — `/insights`

| File | Purpose | Desktop | Mobile |
|---|---|---|---|
| `src/components/insights/insights-page.tsx` | Rule cards + Agent FAB; tap card → subject report | Card grid + modal | Stack + bottom sheet |
| `src/components/insights/rule-cards.tsx` | Clickable eligibility cards from Dexie standings | Multi-column cards | Vertical stack |
| `src/components/subjects/subject-report-sheet.tsx` | Subject report: % / risk / bunks + week-grouped schedule + marks | Centered modal | Bottom sheet |
| `src/components/insights/coach-chat.tsx` | Full Groq chat UI → `POST /api/ai/coach` with live stats JSON | Tall panel, always usable | Full-width chat; clear loading/errors |

Coach must work when `GROQ_API_KEY` is set server-side; show a clear error if the key is missing. Stats may be empty/zeros — the model must not invent attendance numbers.

### Plan — `/plan`

| File | Purpose | Desktop | Mobile |
|---|---|---|---|
| `src/components/plan/plan-page.tsx` | Scenario hub: bunk + safe week + projection | Wide stacked sections | Single column |
| `src/components/plan/bunk-simulator.tsx` | Extra skips + next-class impact from real counts | Side-by-side controls + result | Stacked controls then result |
| `src/components/plan/safe-week-planner.tsx` | Date-range miss impact per subject | Wide table | Scrollable stack |
| `src/components/plan/semester-projection.tsx` | Remaining classes vs target with blackouts | Wide table | Compact rows |
| `src/components/plan/safe-week-page.tsx` | Dedicated `/plan/safe-week` shell | Same planner | Full-bleed |
| `src/components/settings/calendar-blocks-editor.tsx` | Exam/holiday blocks that suppress teaching | Form in Plan | Stacked form |
| `src/components/settings/daily-periods-editor.tsx` | Fixed daily period template for quick-add chips | Form in Settings | Stacked form |

### Analytics — `/analytics`

| File | Purpose | Desktop | Mobile |
|---|---|---|---|
| `src/components/analytics/analytics-page.tsx` | Streaks, weekday patterns, print report | Multi-section layout | Stacked |
| `src/components/analytics/streak-cards.tsx` | Present / mark streak stats | Card row | Stack |
| `src/components/analytics/pattern-cards.tsx` | “You miss Mondays” style insights | Card grid | Stack |
| `src/components/analytics/print-report.tsx` | Browser print / PDF subject table | Print stylesheet | Same |

### Settings — `/settings`

| File | Purpose | Desktop | Mobile |
|---|---|---|---|
| `src/app/settings/page.tsx` | Criteria, working days, **Daily periods**, **Notifications**, schedule JSON backup (no marks), PDF, a11y toggles | Form in content pane | Full-width form |

### Onboarding — `/onboarding`

| File | Purpose | Desktop | Mobile |
|---|---|---|---|
| `src/app/onboarding/page.tsx` | First-run (auth required): criteria 75/80/85, semester, buffer → `saveSettings({ onboarded: true })` | Centered form in bare frame (no nav) | Full-screen steps, large taps |
| `src/components/onboarding/onboarding-intro.tsx` | Welcome headline (signed-in; criteria still on-device) | Same | Same |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | Clerk `<SignIn />` → redirect `/` | Centered | Same |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | Clerk `<SignUp />` → redirect `/` | Centered | Same |
| Bare chrome (`AppFrame`) | Centered `ThemeToggle` + `ClerkAuthControls` (Sign in/up or `UserButton`) | Same | Same |

---

## 5. Shared primitives

Prefer small, reusable pieces under `src/components/ui/` (or `src/components/shared/` — pick one folder and stay consistent).

| File | Purpose | Desktop | Mobile |
|---|---|---|---|
| `src/components/ui/button.tsx` | Primary / secondary / ghost / danger actions | Comfortable padding | Min touch ~44px where used in thumb zone |
| `src/components/ui/card.tsx` | Surface for interactive or dense content only (not decorative chrome) | Optional hover elevation | Flat, clear borders |
| `src/components/ui/pct-ring.tsx` | Shared % ring if extracted from subjects (or re-export `subjects/pct-ring`) | Size variants (`sm` / `md` / `lg`) | Prefer `md` |
| `src/components/ui/empty-hub.tsx` | Reusable empty-hub layout: title, short copy, CTA row, wash/pattern | Used by Today + feature pages | Same CTAs, stacked buttons |
| `src/components/ui/page-header.tsx` | Title + optional actions for feature pages | Aligns with side-nav content inset | Compact top header |
| `src/lib/utils/cn.ts` | `className` merge helper | Same | Same |

**Visual language:** Fraunces (display) + DM Sans (body), daylight traffic-light tokens, subject palette from `src/lib/db/subject-palette.ts`. Avoid purple-glow / generic dashboard chrome.

---

## Route → component quick map

| Route | Page entry | Primary components |
|---|---|---|
| `/` (signed out) | `src/app/page.tsx` | `landing-page` |
| `/` (signed in) | `src/app/page.tsx` | `today-screen`, `risk-banner`, `agenda-list`, `mark-actions`, `empty-hub`, `ai-dock` |
| `/sign-in` | `src/app/sign-in/[[...sign-in]]/page.tsx` | Clerk `<SignIn />` (bare) |
| `/sign-up` | `src/app/sign-up/[[...sign-up]]/page.tsx` | Clerk `<SignUp />` (bare) |
| `/onboarding` | `src/app/onboarding/page.tsx` | Onboarding flow (bare shell; auth required) |
| `/timetable` | `src/app/timetable/page.tsx` | `timetable-page`, day-chips, slot-list, add-slot-form, toolbar |
| `/subjects` | `src/app/subjects/page.tsx` | `subjects-page`, subject-card, pct-ring |
| `/calendar` | `src/app/calendar/page.tsx` | `calendar-page`, month-grid |
| `/import` | `src/app/import/page.tsx` | `import-page`, photo-import, file-import, preview-editor, json-import |
| `/insights` | `src/app/insights/page.tsx` | `insights-page`, rule-cards, coach-chat |
| `/analytics` | `src/app/analytics/page.tsx` | `analytics-page`, streak-cards, pattern-cards, print-report |
| `/plan` | `src/app/plan/page.tsx` | `plan-page`, bunk-simulator, safe-week-planner, semester-projection, calendar-blocks-editor |
| `/plan/safe-week` | `src/app/plan/safe-week/page.tsx` | `safe-week-page` / planner |
| `/settings` | `src/app/settings/page.tsx` | Criteria, working days, Notifications, backup |

Signed-in app routes sit inside `AppFrame` shell. Bare: landing (signed out), onboarding, sign-in, sign-up.

---

## Implementation checklist (redesign)

- [x] `AppFrame` switches: side nav desktop / bottom nav mobile; drop phone-only `max-w-lg` on `md+`
- [x] Add `side-nav.tsx`; hide `bottom-nav` at `md+`
- [x] Today grid + `empty-hub` + `ai-dock`
- [x] Promote `coach-chat` as a first-class panel (Insights + Today dock)
- [x] Widen Subjects / Timetable / Calendar / Import / Plan / Settings for laptop
- [x] Shared `ui/*` primitives (`button`, `card`, `empty-hub`, optional `page-header`)
- [x] Journal changelog when redesign lands; keep this map updated if paths change

**Also shipped:** `standing-hero.tsx` (big % ring for Today), `nav-config.ts`, `lib/ai/build-coach-stats.ts`, `shell/page-shell.tsx`.

---

## What this map is not

- Not a seed of demo attendance  
- Not cloud auth / multi-user chrome (see [future-improvements.md](./future-improvements.md))  
- Paths above match the shipped tree under `src/components/` (plus `standing-hero`, `nav-config`, `build-coach-stats`)
