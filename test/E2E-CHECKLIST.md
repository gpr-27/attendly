# Attendly — Manual E2E Checklist

Automated coverage lives under `test/unit` and `test/integration`.  
Use this list after deploy or before trusting a new device.

**Rule:** No demo/seed data. Everything comes from what **you** enter or from **AI** parse/coach.

## Auth + fresh install

- [ ] Signed out → landing only (Attendly brand + Sign in / Sign up); **no** Today/agenda/shell data
- [ ] Visit `/timetable` (or other app route) unsigned → redirected to `/`
- [ ] Sign in / Sign up → land on **Today**, or `/onboarding` if not onboarded yet
- [ ] Pick 75 / 80 / 85, optional buffer, semester name/dates → Save
- [ ] Land on **Today** with empty agenda (“Add a timetable…”) — not fake classes

## Timetable + materialize

- [ ] `/subjects` or timetable flow: add a real subject (your code + color)
- [ ] `/timetable`: add Mon–Sat slots; **Copy day** works
- [ ] Sessions appear on **Today** for matching weekdays (after materialize / semester dates set)
- [ ] **+ Extra class** creates one occurrence for today
- [ ] **Cancel today** on a slot → status cancelled; does not punish % like Absent

## Marking ritual

- [ ] One-tap Present / Absent / Cancelled / Holiday / On Duty
- [ ] Undo clears mark
- [ ] Risk banner + big % update from **your** marks only
- [ ] Impact line uses real bunk math (skip vs attend)
- [ ] Unmarked catch-up strip for past unmarked classes

## Subjects / calendar / plan

- [ ] `/subjects` rings reflect standing; empty state if no subjects
- [ ] `/calendar` month dots from real sessions/marks
- [ ] `/plan` scenario uses your subject counts (not invented rows)

## Import + Insights

- [ ] `/import` photo → Gemini preview (editable) → confirm writes **your** subjects/slots
- [ ] Without `GEMINI_API_KEY`: clear error, app still usable
- [ ] `/insights` rule cards from your stats; Groq chat optional
- [ ] Without `GROQ_API_KEY`: clear error / rule-card fallback

## Settings + PDF

- [ ] Change criteria / OD rules / theme
- [ ] **Download attendance PDF** from Settings / Analytics / Today → print dialog → Save as PDF
- [ ] Confirm no Export/Import JSON or share-code UI
- [ ] Confirm no Clerk login wall

## PWA / Vercel

- [ ] `npm run build` succeeds locally
- [ ] Deployed URL loads; AI works only if Vercel env keys set
- [ ] Add to Home Screen; Today still works offline for marks (AI needs network)
