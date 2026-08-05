# Attendly — Product Review & Roadmap

**Last reviewed:** 2026-08-06  
**Live app:** [attendly-navy.vercel.app](https://attendly-navy.vercel.app)  
**Repo:** [gpr-27/attendly](https://github.com/gpr-27/attendly)

This document is a **complete feature inventory** of what Attendly does today, **gaps and polish** worth fixing, and **what to build next** — including advanced AI ideas and non-AI product features.

For implementation history, see [IMPLEMENTATION-JOURNAL.md](./IMPLEMENTATION-JOURNAL.md).  
For UI structure, see [UI-COMPONENT-MAP.md](./UI-COMPONENT-MAP.md).  
*(Note: [future-improvements.md](./future-improvements.md) predates Clerk + Supabase sync — use this doc as the current roadmap.)*

---

## 1. What Attendly is today

Attendly is a **personal attendance co-pilot** for students:

- Track **per-subject %** against college minimum (default 75%) + personal buffer
- **Mark** classes (Present / Absent / Cancelled / Holiday / On Duty)
- **Plan bunks** with deterministic math (not LLM guesses)
- **AI coach** for advice and guided timetable changes
- **Clerk auth** + **Supabase Postgres** sync (Dexie = offline cache per user)

**Design principle:** Rules own the math; AI explains and guides — it never invents attendance numbers.

---

## 2. Feature inventory (shipped)

### Auth & identity
| Feature | Status | Where |
|--------|--------|--------|
| Clerk sign-in / sign-up (Google, email, etc.) | ✅ | `/sign-in`, `/sign-up`, landing |
| Auth gate — signed-out = landing only | ✅ | `src/proxy.ts` |
| Per-user Dexie DB (`AttendlyDB_u_<userId>`) | ✅ | `database.ts`, `UserDatabaseProvider` |
| Clerk ↔ Supabase identity (`clerk_user_id`) | ✅ | `/api/sync`, `clerk-identity.ts` |
| Onboarding (criteria, semester, buffer) | ✅ | `/onboarding` |

### Data & sync
| Feature | Status | Where |
|--------|--------|--------|
| Dexie offline cache | ✅ | `src/lib/db/` |
| Supabase cloud sync (pull/push on bind + debounced push) | ✅ | `cloud-sync.ts`, `/api/sync` |
| Schedule JSON export/import (**no marks** in file) | ✅ | Settings → schedule backup |
| Import → required cloud push | ✅ | `export-import.ts` |
| Attendance PDF (print / Save as PDF) | ✅ | Settings, Analytics, Today |
| Legacy Dexie migration on first login | ✅ | `bindDatabaseForUser` |

### Today (daily ritual)
| Feature | Status | Where |
|--------|--------|--------|
| Day agenda from materialized sessions | ✅ | `today-screen`, `load-day-agenda` |
| Day navigator (any date) | ✅ | `day-navigator` |
| Mark actions P/A/C/H/OD + undo | ✅ | `mark-actions`, `agenda-list` |
| Standing hero — per-subject rings + 75% line | ✅ | `standing-hero` |
| Risk banner (Safe / Warning / Critical) | ✅ | `risk-banner` |
| Unmarked catch-up nudge | ✅ | `today-screen` |
| Mark all present | ✅ | Today agenda header |
| Move / delete cancelled / remove extra | ✅ | dialogs + timetable libs |
| Deep link `/?action=mark-next` | ✅ | PWA manifest shortcut |
| Agent Control (Today only) | ✅ | `ai-dock`, `agent-sheet` |

### Timetable
| Feature | Status | Where |
|--------|--------|--------|
| Day-focused timetable (pick date, see sessions) | ✅ | `day-timetable` |
| Quick Add — This date / Every week | ✅ | `quick-add-sheet` |
| **Multi-day select** on weekly Quick Add | ✅ | recent |
| Period slot chips (free/taken) | ✅ | `period-slot-chips` |
| Move / Change / Cancel with scope | ✅ | dialogs |
| Copy weekday pattern | ✅ | `timetable-toolbar` |
| Odd/even week parity | ✅ | series + materializer |
| Makeup / substitution (`replacesSessionId`) | ✅ | `makeup-prompt` |
| `.ics` export (one-way) | ✅ | toolbar |
| Semester materialization | ✅ | `ensure-materialized` |

### Subjects & reports
| Feature | Status | Where |
|--------|--------|--------|
| Subject cards with % ring + bunk insight | ✅ | `subjects-page` |
| Per-subject component targets | ✅ | `component-targets-form` |
| Subject report sheet (schedule + marks by week) | ✅ | Coach + Subjects tap |
| Remove subject (cascade) | ✅ | `subjects-page` |

### Plan & bunk intelligence
| Feature | Status | Where |
|--------|--------|--------|
| **Advanced bunk simulator** (overview, pick classes, recovery) | ✅ | `bunk-simulator` |
| Safe-week planner (miss date range) | ✅ | `/plan`, `/plan/safe-week` |
| Semester-end projection (blackout-aware) | ✅ | `semester-projection` |
| Exam/holiday calendar blocks | ✅ | `calendar-blocks-editor` |
| Term-bounded “can bunk N of Rem left” | ✅ | `bunk-insight`, `bunk-math` |

### Calendar & analytics
| Feature | Status | Where |
|--------|--------|--------|
| Month grid with day status dots | ✅ | `calendar-page` |
| Day agenda under calendar | ✅ | `day-agenda` |
| Streak cards | ✅ | `streak-cards` |
| Weekday absence patterns (2–3 key points) | ✅ | `pattern-cards`, `buildAnalyticsKeyPoints` |
| Printable attendance report | ✅ | `print-report` |

### Import
| Feature | Status | Where |
|--------|--------|--------|
| Photo timetable → Gemini (+ Groq vision fallback) | ✅ | `photo-import`, `/api/ai/parse-timetable` |
| Tabular file / text parse | ✅ | `file-import`, parse routes |
| Preview + diff merge vs full replace | ✅ | `preview-editor` |
| Confidence / field highlights | ✅ | preview UI |

### AI
| Feature | Status | Where |
|--------|--------|--------|
| Groq coach chat | ✅ | `/api/ai/coach`, `coach-chat` |
| Modes: chat, digest, plan (structured JSON) | ✅ | coach route |
| Groq 70B → 8B fallback on 429 | ✅ | coach route |
| Local bunk fallback when coach rate-limited | ✅ | `local-coach-fallback` |
| Agent Control — Chat vs Agent dual mode | ✅ | `agent-control` |
| Guided walkthroughs (add subject/class, holiday, delete) | ✅ | `agent-flows`, `action-runner` |
| Insight popup on subject/class tap (non-coach pages) | ✅ | `insight-popup` |
| Page context stats injected into coach | ✅ | `build-coach-stats` |
| AI status / setup hints when keys missing | ✅ | `/api/ai/status` |
| Optional `groq/compound` policy research (OFF default) | ✅ | coach route |

### Notifications & PWA
| Feature | Status | Where |
|--------|--------|--------|
| PWA manifest + shortcuts | ✅ | `public/manifest` |
| Local pre-class T−15 / T−5 | ✅ | Settings + `notifications/` |
| Post-class mark nudge | ✅ | same |
| Critical alert (bunk buffer ≤ 1) | ✅ | same |
| Service worker for scheduled notifications | ✅ | `public/sw.js` |

### Settings & accessibility
| Feature | Status | Where |
|--------|--------|--------|
| Criteria %, buffer, semester range | ✅ | Settings |
| Daily period slots editor | ✅ | `daily-periods-editor` |
| OD policy (present / absent / exclude) | ✅ | Settings |
| Theme light / dark / system | ✅ | `theme-toggle` |
| High contrast, large taps, reduced motion | ✅ | Settings → `html` data attrs |
| Working days | ✅ | Settings |

### Shell & UX
| Feature | Status | Where |
|--------|--------|--------|
| Responsive side nav (desktop) + bottom nav (mobile) | ✅ | `app-frame` |
| Mobile safe-area + bottom-sheet dialogs | ✅ | recent pass |
| Signed-out landing (wide desktop layout) | ✅ | `landing-page` |

---

## 3. Gaps & improvements (existing features)

These are **not new products** — they make what you already have stronger.

### A — Reliability & sync
| Gap | Why it matters | Suggestion |
|-----|----------------|------------|
| Sync conflict UI | Two devices editing same mark offline → last-write-wins is silent | Show “Synced / Conflict / Offline” badge; optional merge picker for marks |
| Sync status in Settings | Users don’t know if cloud is healthy | Last sync time, error retry, “Force pull / push” |
| README still says “no cloud sync” | Confusing for you and contributors | Update README to reflect Supabase (partially done in journal) |
| RLS / client Supabase path | Service-role-only is fine for v1; harder to scale | Later: Clerk JWT template + RLS policies per `clerk_user_id` |
| E2E automated tests | Manual checklist only | Playwright: sign-in → mark → sync smoke on preview |

### B — Bunk & planning polish
| Gap | Suggestion |
|-----|------------|
| Simulator doesn’t apply scenario to **calendar pick** then one-tap “mark absent” | “Simulate → Apply as plan” saves a draft week of intended skips |
| Safe week + bunk sim overlap | Link “Open in simulator” from safe-week rows |
| Component-level bunk (Lab vs Theory) | Standing already supports `componentTargets` — surface in simulator + Coach |
| Overall aggregate % | You intentionally use **per-subject** only — add optional “weakest subject” dashboard tile, not blended % |

### C — Timetable & calendar
| Gap | Suggestion |
|-----|------------|
| No true **heatmap** calendar | Color intensity by absence rate per day (analytics polish) |
| Google Calendar **two-way** sync | OAuth read/write — high effort, high value for some users |
| Share timetable with friends | Share codes were removed — cloud share link after auth |
| Bulk mark day (all absent / all present) | Useful for mass bunk days with confirmation |
| Recurring holiday templates | “Every Sunday”, college calendar import |

### D — Import & export
| Gap | Suggestion |
|-----|------------|
| PDF timetable import | OCR pipeline beyond photo (multi-page PDF) |
| Export marks to CSV | For spreadsheets / parents — optional privacy warning |
| Encrypted backup blob | Password-protected full backup including marks |

### E — Notifications
| Gap | Suggestion |
|-----|------------|
| Local only — no push when app killed on iOS | **Web Push** server (VAPID) when you want cross-device alerts |
| Per-subject notification rules | “Only warn for subjects below 80%” |
| Smart nudge: “You usually forget Thursday lab” | Use weekday pattern analytics |

### F — AI UX polish
| Gap | Suggestion |
|-----|------------|
| Agent only full-screen on Today / Coach / Analytics | Extend Insight popup with “Ask follow-up” inline |
| No conversation memory across sessions | Optional “remember my target habits” in settings (stored locally) |
| Plan mode JSON not always actionable | Render plan cards with **Apply** buttons wired to `action-runner` |
| Voice input / output | Web Speech API for hands-free mark + coach |

### G — Performance & scale
| Gap | Suggestion |
|-----|------------|
| Full semester materialize on every load | Incremental materialize + indexed date range |
| Large photo upload on serverless | Direct-to-storage upload + async parse job |
| Load testing | k6 scripts for `/api/sync` + coach with auth cookies |
| Rate limits on AI routes | Upstash Redis when exposing beyond personal use |

---

## 4. New features to add (non-AI)

Prioritized for **personal use first**, then **if you open to others**.

### Tier 1 — High value, fits Attendly
1. **Weekly digest email / notification** — “3 subjects need attention this week” (rules-based, not LLM)
2. **Attendance goals & milestones** — “Reach 80% in OS by midterm” with progress bar
3. **Exam mode** — Lock targets during exam week; suppress bunk suggestions
4. **Friend compare (privacy-safe)** — Share **only** “am I above 75%?” yes/no, not marks
5. **Widget / Live Activity** — Next class + mark shortcut (iOS/Android limits; PWA shortcuts exist)
6. **Timetable templates** — “Standard B.Tech sem 5 CSE” starter grid
7. **Audit log** — Who changed what (useful when sync conflicts matter)
8. **Offline queue indicator** — Marks queued while offline, flush when online

### Tier 2 — Quality of life
9. **Subject notes** — “Prof counts late as absent” per subject
10. **Custom mark types** — Medical leave, event (if OD policy insufficient)
11. **Multi-semester archive** — Roll forward to new semester without losing history
12. **Dark mode AMOLED pure black** — optional third theme
13. **Hindi / regional language UI** — i18n layer
14. **Apple Watch / Wear quick mark** — companion PWA or shortcut

### Tier 3 — Product / campus (only if pivoting)
15. Class rep bulk upload for section  
16. Teacher verification portal  
17. Geo / QR check-in  
18. Face recognition attendance  

*(Tier 3 is a different product — skip unless you explicitly pivot.)*

---

## 5. Advanced AI features

All AI features should **ground on Dexie/Supabase stats** and **never compute % in the model**.

### 5.1 Coach & conversation
| Idea | Description | Effort |
|------|-------------|--------|
| **Proactive daily briefing** | On open Today: 2-line LLM summary from structured stats (“ML lab risky; OS safe for 1 bunk”) | Medium |
| **Natural language mark** | “Mark last class absent” → resolves session → `markDaySession` | Medium |
| **What-if in chat** | “If I bunk ML twice and attend OS thrice?” → call `simulateBunkScenario` server-side | Low |
| **Semester narrative** | End-of-term story from analytics (streaks, patterns) for PDF appendix | Medium |
| **Multi-turn plan execution** | Coach plan JSON → sequential `AttendlyAction` with user confirm each step | Medium |
| **Voice coach** | STT question + TTS short answer (Groq + browser APIs) | Medium |

### 5.2 Timetable intelligence
| Idea | Description | Effort |
|------|-------------|--------|
| **Smarter import validation** | LLM compares parsed grid vs existing series; highlights conflicts only | Medium |
| **“Fix my timetable” agent** | Detect overlap gaps, suggest slot moves (rules first, LLM phrasing) | High |
| **Portal scrape assist** | User pastes college portal HTML; extract timetable (careful ToS) | High |
| **Screenshot batch import** | Multiple photos → merge one semester grid | Medium |

### 5.3 Predictive & optimization
| Idea | Description | Effort |
|------|-------------|--------|
| **Optimal bunk scheduler** | OR-Tools / greedy: maximize free days subject to all subjects ≥ target | High |
| **Risk forecast** | Project risk band at week 4, 8, 12 from current pace | Low (rules) |
| **Pattern-aware coach** | “You miss 80% of Monday slots” injected into coach system prompt | Low |
| **Exam crunch planner** | Given exam dates + blackouts, minimum attend path | Medium |

### 5.4 Agents & automation
| Idea | Description | Effort |
|------|-------------|--------|
| **Scheduled agent** | Weekly cron (Vercel Cron): run digest, email via Resend | Medium |
| **Tool-calling coach** | Groq function tools: `getStanding`, `simulateBunk`, `addSeries` | Medium |
| **Import agent** | End-to-end: photo → preview → user confirm → Dexie + sync | Partially done |
| **MCP server for Attendly** | Expose read-only stats to Cursor/Claude for you | Low fun project |

### 5.5 Safety & cost controls
| Idea | Description |
|------|-------------|
| **Prompt injection guard** | Strip user messages that ask to ignore stats |
| **Token budget per day** | Cap coach calls in Settings |
| **On-device classification** | Tiny model routes “chat vs mutate” before Groq (optional) |
| **Audit AI actions** | Log which agent actions ran (local table) |

---

## 6. Technical improvements

| Area | Recommendation |
|------|----------------|
| **Testing** | Playwright E2E for auth + mark + sync; keep vitest for bunk math |
| **CI** | GitHub Actions: test + build on PR |
| **Monitoring** | Sentry for client errors; Vercel log drains for `/api/sync` failures |
| **Database** | Supabase advisors (indexes on `clerk_user_id`, session date) |
| **Security** | Rotate keys if ever exposed; Clerk allowlist for personal deploy |
| **Docs** | Retire stale sections in `future-improvements.md`; point here |
| **i18n** | Extract strings if you add Hindi/regional |

---

## 7. Suggested build order (next 90 days)

For **solo personal use**, this order maximizes daily value:

```
Phase 1 — Trust the data (2–3 weeks)
├── Sync status UI + last synced + force sync
├── README + landing copy aligned with cloud sync
└── Playwright smoke: login → mark → reload → still there

Phase 2 — Planning depth (2–3 weeks)
├── Bunk sim → "Apply plan" (optional marks draft)
├── Component-level targets in simulator + Coach
└── Calendar heatmap (absence intensity)

Phase 3 — AI that acts (3–4 weeks)
├── NL mark ("mark last class absent")
├── What-if in coach chat (wired to bunk-simulator-math)
├── Plan cards with Apply → action-runner
└── Proactive Today briefing (2 lines, stats-grounded)

Phase 4 — Reach & alerts (when needed)
├── Web Push (Vercel + VAPID) for cross-device
├── Weekly rules-based digest notification
└── Rate limits + monitoring if others use it
```

If you **stay personal-only**, stop after Phase 3. Phase 4 matters when you want alerts with the app fully closed on phone.

---

## 8. What not to build (scope guardrails)

- **Blended “overall attendance %”** as primary metric — conflicts with per-subject eligibility  
- **LLM-calculated bunk counts** — keep `bunk-math.ts` as source of truth  
- **MongoDB/Redis as primary DB** — Postgres + Dexie is correct  
- **Social leaderboard / public profiles** — privacy nightmare for attendance  
- **Geo/facial check-in** — different product and compliance burden  

---

## 9. Quick reference — key code locations

| Domain | Path |
|--------|------|
| Bunk math | `src/lib/attendance/bunk-math.ts`, `bunk-simulator-math.ts` |
| Cloud sync | `src/lib/db/cloud-sync.ts`, `src/app/api/sync/` |
| Materializer | `src/lib/timetable/materialize-sessions.ts` |
| Coach API | `src/app/api/ai/coach/route.ts` |
| Agent flows | `src/lib/ai/agent-flows.ts`, `actions.ts` |
| Import AI | `src/app/api/ai/parse-timetable/` |
| Notifications | `src/lib/notifications/` |
| Auth | `src/proxy.ts`, Clerk provider in `layout.tsx` |

---

## 10. Summary

**Attendly today** is a capable personal attendance system: real math, real sync, real AI coach, and a recently upgraded bunk simulator and mobile shell.

**Best next investments:**

1. **Sync transparency** — so you trust phone + laptop  
2. **AI that calls your math** — what-if, NL mark, actionable plans  
3. **Visual analytics** — heatmap, weekly digest  
4. **Web Push** — only when local notifications aren’t enough  

**Best advanced AI bets:** proactive briefing, tool-calling coach, optimal bunk scheduler (rules + optional LLM explanation layer).

Pick one phase, ship it, append to [IMPLEMENTATION-JOURNAL.md](./IMPLEMENTATION-JOURNAL.md), and iterate.
