import { addDaysYmd, dayBoundsIso, dayOfWeekFromYmd, todayYmd } from "@/lib/dates"
import {
  getSession,
  listSessionsInRange,
  listSubjects,
  type ClassSession,
  type PeriodSlot,
} from "@/lib/db"
import { subjectPrimaryLabel } from "@/lib/subject-label"

/** True when [aStart,aEnd) overlaps [bStart,bEnd) on the same calendar day (HH:mm). */
export function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

function hmFromIso(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export type OverlapConflict = {
  sessionId: string
  subjectId: string
  shortCode: string
  name: string
  startTime: string
  endTime: string
}

export type OverlapCheckResult =
  | { ok: true }
  | { ok: false; message: string; conflicts: OverlapConflict[] }

export type PeriodOccupant = OverlapConflict

export type PeriodSlotOccupancy = {
  index: number
  taken: boolean
  occupants: PeriodOccupant[]
  /** Chip subtitle — “Taken · Machine Learning”. */
  takenLabel: string | null
  /** Native tooltip / title — name · times (or Free). */
  tooltip: string
}

function isActiveOnDay(session: ClassSession): boolean {
  if (session.status === "cancelled" || session.status === "holiday") {
    return false
  }
  return session.relevance !== "substitution" || session.status === "scheduled"
}

export type DayOverlapExclude = {
  /** Session being moved — excluded from conflicts. */
  excludeSessionId?: string | null
  /** Weekly series being edited — its occurrence that day stays selectable. */
  excludeSeriesId?: string | null
}

type DaySessionRow = {
  sessionId: string
  seriesId: string | null
  subjectId: string
  startTime: string
  endTime: string
  name: string
  shortCode: string
}

async function loadDaySessionRows(
  date: string,
  exclude?: DayOverlapExclude,
): Promise<DaySessionRow[]> {
  const bounds = dayBoundsIso(date)
  const [sessions, subjects] = await Promise.all([
    listSessionsInRange(bounds.fromIso, bounds.toIso),
    listSubjects(),
  ])
  const subjectById = new Map(subjects.map((s) => [String(s.id), s]))
  const excludeSessionId = exclude?.excludeSessionId
  const excludeSeriesId = exclude?.excludeSeriesId
  const rows: DaySessionRow[] = []

  for (const session of sessions) {
    if (excludeSessionId && String(session.id) === String(excludeSessionId)) {
      continue
    }
    if (
      excludeSeriesId &&
      session.seriesId != null &&
      String(session.seriesId) === String(excludeSeriesId)
    ) {
      continue
    }
    if (!isActiveOnDay(session)) continue
    const subject = subjectById.get(String(session.subjectId))
    rows.push({
      sessionId: String(session.id),
      seriesId: session.seriesId != null ? String(session.seriesId) : null,
      subjectId: String(session.subjectId),
      startTime: hmFromIso(session.startsAt),
      endTime: hmFromIso(session.endsAt),
      shortCode: subject?.shortCode ?? "Class",
      name: subjectPrimaryLabel({
        name: subject?.name,
        shortCode: subject?.shortCode,
      }),
    })
  }
  return rows
}

function conflictsForWindow(
  rows: DaySessionRow[],
  startTime: string,
  endTime: string,
): OverlapConflict[] {
  const conflicts: OverlapConflict[] = []
  for (const row of rows) {
    if (!timesOverlap(startTime, endTime, row.startTime, row.endTime)) continue
    conflicts.push({
      sessionId: row.sessionId,
      subjectId: row.subjectId,
      shortCode: row.shortCode,
      name: row.name,
      startTime: row.startTime,
      endTime: row.endTime,
    })
  }
  return conflicts
}

/** Tooltip / chip copy — prefer subject name. */
export function formatOccupancyTooltip(occupants: PeriodOccupant[]): string {
  if (occupants.length === 0) return "Free"
  return occupants
    .map((c) => `${c.name} · ${c.startTime}–${c.endTime}`)
    .join(" · ")
}

export function formatTakenChipLabel(occupants: PeriodOccupant[]): string {
  if (occupants.length === 0) return "Taken"
  const first = occupants[0]!
  if (occupants.length === 1) return `Taken · ${first.name}`
  return `Taken · ${first.name} +${occupants.length - 1}`
}

/**
 * Soft-block double-booking: same date, overlapping period times.
 * Ignores cancelled/holiday rows and optionally the session/series being edited.
 */
export async function findDaySlotOverlaps(args: {
  date: string
  startTime: string
  endTime: string
  excludeSessionId?: string | null
  excludeSeriesId?: string | null
}): Promise<OverlapCheckResult> {
  const { date, startTime, endTime, excludeSessionId, excludeSeriesId } = args
  if (!startTime || !endTime || endTime <= startTime) {
    return {
      ok: false,
      message: "Pick a valid period slot.",
      conflicts: [],
    }
  }

  const rows = await loadDaySessionRows(date, {
    excludeSessionId,
    excludeSeriesId,
  })
  const conflicts = conflictsForWindow(rows, startTime, endTime)

  if (conflicts.length === 0) return { ok: true }

  const list = conflicts
    .map((c) => `${c.name} (${c.startTime}–${c.endTime})`)
    .join(", ")
  return {
    ok: false,
    message: `This class is already going on — you can’t place another here. Conflict: ${list}.`,
    conflicts,
  }
}

/**
 * Free vs taken for each Settings period chip on a calendar day.
 * Own session/series (exclude*) stays free so Edit/Move can keep the current slot.
 */
export async function getPeriodSlotsOccupancy(args: {
  date: string
  slots: PeriodSlot[]
  excludeSessionId?: string | null
  excludeSeriesId?: string | null
}): Promise<PeriodSlotOccupancy[]> {
  const { date, slots, excludeSessionId, excludeSeriesId } = args
  const rows = await loadDaySessionRows(date, {
    excludeSessionId,
    excludeSeriesId,
  })
  return slots.map((slot, i) => {
    const occupants = conflictsForWindow(rows, slot.startTime, slot.endTime)
    const taken = occupants.length > 0
    return {
      index: i,
      taken,
      occupants,
      takenLabel: taken ? formatTakenChipLabel(occupants) : null,
      tooltip: formatOccupancyTooltip(occupants),
    }
  })
}

/**
 * Next calendar date (from today / semester start) matching dayOfWeek (0=Sun…6=Sat).
 * Used when Add/Edit “every week” needs a probe day for occupancy.
 */
export async function probeDateForWeekday(dayOfWeek: number): Promise<string> {
  const { getSettings } = await import("@/lib/db")
  const settings = await getSettings()
  let probe = settings.semesterStart?.trim() || todayYmd()
  if (probe < todayYmd()) probe = todayYmd()
  for (let i = 0; i < 14; i += 1) {
    const ymd = addDaysYmd(probe, i)
    if (dayOfWeekFromYmd(ymd) === dayOfWeek) return ymd
  }
  return todayYmd()
}

/** Convenience when you only have a session id being moved. */
export async function assertNoOverlapForMove(args: {
  sessionId: string
  newDate: string
  startTime: string
  endTime: string
}): Promise<OverlapCheckResult> {
  const existing = await getSession(args.sessionId)
  return findDaySlotOverlaps({
    date: args.newDate,
    startTime: args.startTime,
    endTime: args.endTime,
    excludeSessionId: existing?.id ?? args.sessionId,
  })
}
