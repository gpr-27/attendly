import { format, addMonths } from "date-fns"
import {
  getSettings,
  listSeries,
  saveSettings,
  updateSeries,
} from "@/lib/db"
import { dayOfWeekFromYmd, mondayOfWeekYmd, todayYmd } from "@/lib/dates"
import { materializeSessions, type MaterializeResult } from "./materialize-sessions"

/** Mon=1 … Sat=6, Sun=7 — for comparing weekdays inside a Mon-first week. */
function monFirstOrder(dow: number): number {
  return dow === 0 ? 7 : dow
}

/**
 * Onboarding / autofill used to set semesterStart = "today". When that lands
 * mid-week (e.g. Wed), permanent Mon/Tue series never materialize for that
 * week's Mon/Tue because effectiveFrom is after those dates.
 */
export async function repairMidWeekSemesterStart(): Promise<{
  repaired: boolean
  from?: string
  to?: string
}> {
  const settings = await getSettings()
  const start = settings.semesterStart?.trim() || ""
  if (!start) return { repaired: false }

  const startDow = dayOfWeekFromYmd(start)
  if (startDow === 1) return { repaired: false }

  const monday = mondayOfWeekYmd(start)
  if (monday >= start) return { repaired: false }

  const seriesList = await listSeries()
  const hasEarlierWeekdaySlot = seriesList.some(
    (s) => monFirstOrder(s.dayOfWeek) < monFirstOrder(startDow),
  )
  if (!hasEarlierWeekdaySlot) return { repaired: false }

  await saveSettings({ semesterStart: monday })
  for (const s of seriesList) {
    if (s.effectiveFrom === start) {
      await updateSeries(s.id, { effectiveFrom: monday })
    }
  }
  return { repaired: true, from: start, to: monday }
}

/**
 * Backdate series.effectiveFrom to semesterStart when they start later
 * (so past weeks inside the term get sessions from the permanent pattern).
 */
export async function syncSeriesToSemesterStart(
  semesterStart: string,
): Promise<number> {
  const seriesList = await listSeries()
  let updated = 0
  for (const s of seriesList) {
    if (!s.effectiveFrom || s.effectiveFrom > semesterStart) {
      await updateSeries(s.id, { effectiveFrom: semesterStart })
      updated += 1
    }
  }
  return updated
}

/**
 * Persist semester dates, sync series effectiveFrom, rematerialize full range.
 */
export async function applySemesterRange(input: {
  semesterStart: string
  semesterEnd: string
  semesterName?: string
}): Promise<MaterializeResult & { seriesUpdated: number }> {
  const from = input.semesterStart.trim()
  const to = input.semesterEnd.trim()
  if (!from || !to) throw new Error("Semester start and end are required.")
  if (to < from) throw new Error("Semester end must be on or after start.")

  await saveSettings({
    semesterStart: from,
    semesterEnd: to,
    ...(input.semesterName != null
      ? { semesterName: input.semesterName.trim() }
      : {}),
  })
  const seriesUpdated = await syncSeriesToSemesterStart(from)
  const result = await materializeSessions({ from, to })
  return { ...result, seriesUpdated }
}

/**
 * Resolve a materialize window from settings. When semester dates are blank,
 * fill Monday-of-this-week → +4 months.
 */
export async function resolveMaterializeRange(override?: {
  from?: string
  to?: string
}): Promise<{ from: string; to: string; filledMissing: boolean }> {
  await repairMidWeekSemesterStart()

  const settings = await getSettings()
  const settingsFrom = settings.semesterStart?.trim() || ""
  const settingsTo = settings.semesterEnd?.trim() || ""

  let persistFrom = settingsFrom
  let persistTo = settingsTo
  let filledMissing = false

  if (!persistFrom) {
    persistFrom = mondayOfWeekYmd(todayYmd())
    filledMissing = true
  }
  if (!persistTo || persistTo < persistFrom) {
    persistTo = format(
      addMonths(new Date(persistFrom + "T12:00:00"), 4),
      "yyyy-MM-dd",
    )
    filledMissing = true
  }

  if (filledMissing) {
    await saveSettings({
      semesterStart: persistFrom,
      semesterEnd: persistTo,
    })
    await syncSeriesToSemesterStart(persistFrom)
  }

  const from = (override?.from || persistFrom).trim()
  const to = (override?.to || persistTo).trim()
  return { from, to, filledMissing }
}

/** Expand series → sessions for the semester (or override) range. */
export async function ensureSessionsMaterialized(override?: {
  from?: string
  to?: string
}): Promise<MaterializeResult> {
  const range = await resolveMaterializeRange(override)
  return materializeSessions({ from: range.from, to: range.to })
}

/** Alias used by timetable UI — same as resolveMaterializeRange(). */
export async function ensureSemesterRange() {
  return resolveMaterializeRange()
}
