# Future Improvements (After Personal v1)

**Status:** Ideas only — **not** part of the current personal-use build.  
**Current v1:** No login · Dexie on-device · Vercel · you-only tracker  
**See also:** [AI-attendance-system-plan.md](./AI-attendance-system-plan.md) · [PLUGINS-RECOMMENDED.md](./PLUGINS-RECOMMENDED.md) (Cursor MCP / Marketplace when you add Clerk, DB, push, etc.)

Use this list when v1 is stable and you want to grow the app.

---

## Priority tiers

| Tier | Meaning |
|---|---|
| **A — High value later** | Worth doing if you outgrow single-device personal use |
| **B — Nice polish** | Quality-of-life once core habit is solid |
| **C — Stretch / product** | Only if you open the app to others or want a “product” |

---

## A — Accounts, sync, and reliability

### 1. Clerk login + sessions
- Sign-in with Google / email (Clerk)
- Real sessions so you’re not “anonymous browser storage”
- Protect AI API routes with auth (today anyone with the URL could hit your Vercel AI endpoints if they discover them)
- Optional: allowlist only your Clerk user id so the deploy stays personal even with login

### 2. Cloud sync (multi-device)
- **Postgres (Supabase or Neon)** as source of truth after login
- Keep **Dexie as offline cache** → sync when online
- Same data on phone + laptop without manual JSON export
- Conflict rules: last-write-wins per session mark, or “device wins if newer `markedAt`”

### 3. Automatic backups
- Scheduled export to download / email yourself a weekly JSON
- Or encrypted backup blob in cloud storage after Clerk
- “New phone” restore wizard

### 4. Private deploy hardening
- Simple password / Clerk gate on the whole PWA
- Vercel Deployment Protection or middleware allowlist
- Rotate Groq/Gemini keys; never commit secrets

---

## A — Attendance intelligence (still personal)

### 5. Richer bunk planning — **done (personal Dexie)**
- [x] Semester-end projection with exam-week / holiday blackouts (`calendarBlocks` UI + materializer `suppressesTeaching`)
- [x] “Safe week” planner at `/plan` and `/plan/safe-week` (festivals, travel, placements)
- [x] Per-component rules — subject `componentTargets` + series `sessionType` / optional `targetPct`; `resolveCollegeTargetPct` in standing math
- **Files:** `src/lib/attendance/{projection,safe-week,targets}.ts`, `src/components/plan/*`, `src/components/settings/calendar-blocks-editor.tsx`

### 6. Smarter timetable ✅ (personal Dexie — 2026-08-05)
- [x] Odd/even week patterns (`weekParity` + ISO week in materializer)
- [x] Substitution / makeup linked to cancelled class (`replacesSessionId`, cancel today → Add makeup)
- [x] Import from Excel / CSV / PDF text (beyond photo) + preview confirm
- [x] Google Calendar **export** one-way via `.ics` download (no OAuth)
- Still later: two-way Google Calendar sync / OAuth

### 7. Notifications (PWA) ✅ (local — 2026-08-05)
- [x] Local reminders via Notification API + optional service worker (no push server)
- [x] Pre-class T−15 / T−5 (Settings)
- [x] Post-class “mark attendance” nudge
- [x] Critical subject alert when bunk buffer ≤ 1
- Still later: Web Push with a server when multi-device sync exists

---

## B — UX polish

### 8. Home-screen widgets / shortcuts ✅ (core — 2026-08-05)
- [x] Deep link `/?action=mark-next` focuses next unmarked class on Today
- [x] PWA manifest shortcuts (Mark next + Analytics)
- Still later: true home-screen widgets / share-sheet quick actions (OS limits)

### 9. History & analytics ✅ (core — 2026-08-05)
- [x] Streaks + weekday absence pattern cards (`/analytics`)
- [x] Printable subject report (browser print / PDF)
- Still later: full heatmaps calendar viz; parent/advisor-branded PDF templates

### 10. Themes & accessibility ✅ (toggles — 2026-08-05)
- [x] High-contrast, larger tap targets, reduced motion prefs on Settings
- Still later: custom subject icons

### 11. Onboarding shortcuts ✅ (core — 2026-08-05)
- [ ] Class-rep / friend timetable share codes (removed from UI; revisit later)
- [x] Import preview confidence / missing-field highlights
- Still later: cloud share links after auth

---

## B — AI upgrades

### 12. Groq coach v2 — **done (2026-08-05)**
- Weekly digest (“this week: protect OS Lab”) via coach `mode: "digest"`
- Voice-style short answers; structured JSON plans (`mode: "plan"`)
- Use `groq/compound` only for optional research (policies), not for % math — toggle OFF by default
- See journal: coach v2 + Insights UI

### 13. Gemini import v2 — **done (2026-08-05)**
- Multi-page / messy handwriting prompt + portal room/faculty fields
- Diff import vs full replace in preview confirm
- Built on Gemini 429 retry/model chain + Groq vision fallback (kept)

### 14. Local-first AI fallback — **done (core)**
- If keys missing, bunk math + UI still work; coach/import show setup hints (`GET /api/ai/status`)
- Optional on-device small models later (unlikely needed for personal use)

---

## C — If you ever open it to more people

### 15. Multi-user product path
- Clerk organizations or per-user Postgres rows + RLS
- Rate limits on AI (Upstash Redis)
- Usage quotas / cost controls for Gemini + Groq

### 16. Redis (when traffic exists)
- Cache insight snapshots
- Rate-limit `/api/ai/*`
- **Not** a replacement for Postgres attendance data

### 17. MongoDB (optional side store)
- AI chat logs, raw import JSON, analytics events
- **Never** as primary attendance DB

### 18. Social / campus features (usually skip)
- Shared class groups, leaderboards, teacher portals
- Face / geo check-in — different product; skip unless you pivot

### 19. Monetization (only if public)
- Freemium subjects / AI scans
- Not relevant while personal-only

---

## Suggested order if you revisit later

1. **Clerk + allowlist your account** (secure personal deploy)  
2. **Supabase Postgres sync + Dexie offline** (phone + laptop)  
3. **Web Push** (server) when you need alerts with the app fully closed across devices — local timers already cover installed-PWA / open-tab use  
4. Heatmap calendar viz / branded advisor PDF (analytics polish)  
5. Redis / multi-user only if you stop being the only user  

For which Cursor plugins/MCPs to enable at each step (and what only you must click once), see [PLUGINS-RECOMMENDED.md](./PLUGINS-RECOMMENDED.md).

---

## Integration snapshot (2026-08-05)

| Area | Done now | Still later |
|---|---|---|
| Bunk planning | Safe week, semester projection, component targets | Shared cloud calendar blocks |
| Timetable | Odd/even, makeup, Excel/CSV/PDF, `.ics` export | Two-way Google Calendar OAuth |
| Notifications | Local pre/post/critical + Settings + SW | Server Web Push |
| Analytics / UX | `/analytics` streaks + patterns + Summary PDF; a11y toggles; `/?action=mark-next` + manifest shortcuts | Heatmaps; custom icons; OS widgets; share codes (removed from UI) |
| AI v2 | Coach digest/plan; Gemini 429→Groq; diff import; status hints | On-device models |
| Shell | Responsive side nav + Today AI dock (preserved) | — |

---

## Explicitly not planned for personal v1

- Login wall before first mark  
- Mongo/Redis/Postgres required to use the app  
- Teacher dashboards, face recognition, geofencing  
- Building for “many concurrent users” latency  

When v1 is done and you’re happily tracking attendance on Vercel, pick items from **tier A** first.
