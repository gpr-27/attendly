import {
  db,
  extraOccurrenceKey,
  getSettings,
  listCalendarBlocks,
  listExceptions,
  listSeries,
  putSession,
  seriesOccurrenceKey,
  sessionIdsWithMarks,
  upsertException,
  type CalendarBlock,
  type ClassSession,
  type SeriesException,
  type TimetableSeries,
} from "@/lib/db"
import { matchesWeekParity } from "./week-parity"

export type MaterializeRange = {
  from?: string
  to?: string
}

export type MaterializeResult = {
  upserted: number
  protectedMarked: number
  from: string
  to: string
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function compareYmd(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function eachDateInclusive(
  from: string,
  to: string,
  fn: (date: string, dayOfWeek: number) => void,
): void {
  const cursor = parseYmd(from)
  const end = parseYmd(to)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`Invalid date range: ${from} … ${to}`)
  }
  while (cursor.getTime() <= end.getTime()) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, "0")
    const d = String(cursor.getDate()).padStart(2, "0")
    fn(`${y}-${m}-${d}`, cursor.getDay())
    cursor.setDate(cursor.getDate() + 1)
  }
}

function isDateInBlock(date: string, block: CalendarBlock): boolean {
  return (
    compareYmd(date, block.startsOn) >= 0 &&
    compareYmd(date, block.endsOn) <= 0
  )
}

function teachingSuppressed(date: string, blocks: CalendarBlock[]): boolean {
  return blocks.some((b) => b.suppressesTeaching && isDateInBlock(date, b))
}

function seriesActiveOn(series: TimetableSeries, date: string): boolean {
  if (compareYmd(date, series.effectiveFrom) < 0) return false
  if (series.effectiveTo && compareYmd(date, series.effectiveTo) > 0) {
    return false
  }
  return true
}

export function localDateTimeIso(date: string, timeHm: string): string {
  const [hh, mm] = timeHm.split(":").map(Number)
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString()
}

function exceptionLookup(
  exceptions: SeriesException[],
): Map<string, SeriesException> {
  const map = new Map<string, SeriesException>()
  for (const ex of exceptions) {
    map.set(seriesOccurrenceKey(ex.seriesId, ex.date), ex)
  }
  return map
}

function buildSession(args: {
  series: TimetableSeries
  date: string
  exception?: SeriesException
  existing?: ClassSession
}): ClassSession {
  const { series, date, exception, existing } = args
  const stamp = new Date().toISOString()
  const occurrenceKey = seriesOccurrenceKey(series.id, date)
  const originalStart = localDateTimeIso(date, series.startTime)

  let startTime = series.startTime
  let endTime = series.endTime
  let location = series.location
  let status: ClassSession["status"] = "scheduled"
  let source: ClassSession["source"] = "series"
  let countsTowardAttendance = series.countsTowardAttendance

  if (exception?.type === "cancelled") {
    // Exact "holiday" only — do not match phrases like "holiday makeup".
    const reason = (exception.reason ?? "").trim().toLowerCase()
    status = reason === "holiday" ? "holiday" : "cancelled"
    countsTowardAttendance = false
  } else if (exception?.type === "modified") {
    startTime = exception.newStartTime ?? startTime
    endTime = exception.newEndTime ?? endTime
    location = exception.newLocation ?? location
    source = "exception_modified"
  }

  return {
    id: existing?.id ?? crypto.randomUUID(),
    occurrenceKey,
    subjectId: series.subjectId,
    seriesId: series.id,
    originalStart,
    startsAt: localDateTimeIso(date, startTime),
    endsAt: localDateTimeIso(date, endTime),
    location,
    sessionType: series.sessionType,
    source,
    status,
    countsTowardAttendance,
    relevance: "scheduled",
    replacesSessionId: existing?.replacesSessionId ?? null,
    note: existing?.note,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  }
}

/**
 * Expand weekly series → classSessions (upsert by occurrenceKey).
 * Never deletes sessions that have marks — cancels them instead.
 * Does not invent subjects or demo sessions.
 */
export async function materializeSessions(
  range?: MaterializeRange,
): Promise<MaterializeResult> {
  const settings = await getSettings()
  const from = range?.from ?? settings.semesterStart
  const to = range?.to ?? settings.semesterEnd
  if (!from || !to) {
    throw new Error(
      "Materialize needs a date range (or settings.semesterStart/End)",
    )
  }

  const [seriesList, exceptions, blocks] = await Promise.all([
    listSeries(),
    listExceptions(),
    listCalendarBlocks(),
  ])
  const byException = exceptionLookup(exceptions)
  const working = new Set<number>(settings.workingDays)

  type Draft = {
    series: TimetableSeries
    date: string
    exception?: SeriesException
  }
  const drafts: Draft[] = []
  const plannedKeys = new Set<string>()

  eachDateInclusive(from, to, (date, dayOfWeek) => {
    if (!working.has(dayOfWeek)) return
    if (teachingSuppressed(date, blocks)) return

    for (const series of seriesList) {
      if (series.dayOfWeek !== dayOfWeek) continue
      if (!seriesActiveOn(series, date)) continue
      if (!matchesWeekParity(date, series.weekParity)) continue
      const key = seriesOccurrenceKey(series.id, date)
      const exception = byException.get(key)
      // Hard-cleared occurrences stay out of day views forever.
      if (exception?.type === "deleted") continue
      drafts.push({ series, date, exception })
      plannedKeys.add(key)
    }
  })

  const existingRows =
    plannedKeys.size === 0
      ? []
      : await db.classSessions
          .where("occurrenceKey")
          .anyOf([...plannedKeys])
          .toArray()
  const existingByKey = new Map(
    existingRows.map((s) => [s.occurrenceKey, s]),
  )

  let upserted = 0
  await db.transaction("rw", db.classSessions, async () => {
    for (const draft of drafts) {
      const key = seriesOccurrenceKey(draft.series.id, draft.date)
      await putSession(
        buildSession({ ...draft, existing: existingByKey.get(key) }),
      )
      upserted += 1
    }
  })

  const seriesSessions = (await db.classSessions.toArray()).filter((s) => {
    if (!s.seriesId) return false
    if (s.relevance !== "scheduled") return false
    if (s.source !== "series" && s.source !== "exception_modified") return false
    const datePart = s.occurrenceKey.split("#")[1]
    if (!datePart) return false
    return compareYmd(datePart, from) >= 0 && compareYmd(datePart, to) <= 0
  })

  const marked = await sessionIdsWithMarks(seriesSessions.map((s) => s.id))
  let protectedMarked = 0
  const stamp = new Date().toISOString()

  for (const session of seriesSessions) {
    if (plannedKeys.has(session.occurrenceKey)) continue
    if (marked.has(session.id)) {
      if (session.status !== "cancelled" || session.countsTowardAttendance) {
        await putSession({
          ...session,
          status: "cancelled",
          countsTowardAttendance: false,
          updatedAt: stamp,
        })
      }
      protectedMarked += 1
      continue
    }
    await db.classSessions.delete(session.id)
  }

  return { upserted, protectedMarked, from, to }
}

export async function cancelSeriesOccurrence(
  seriesId: string,
  date: string,
  reason?: string,
): Promise<void> {
  await upsertException({ seriesId, date, type: "cancelled", reason })
  await materializeSessions({ from: date, to: date })
}

export async function modifySeriesOccurrence(
  seriesId: string,
  date: string,
  patch: {
    newStartTime: string
    newEndTime: string
    newLocation?: string
    reason?: string
  },
): Promise<void> {
  await upsertException({
    seriesId,
    date,
    type: "modified",
    newStartTime: patch.newStartTime,
    newEndTime: patch.newEndTime,
    newLocation: patch.newLocation,
    reason: patch.reason,
  })
  await materializeSessions({ from: date, to: date })
}

/** Extra / makeup / substitution — only when explicitly called (never auto-seeded). */
export async function addExtraSession(input: {
  subjectId: string
  date: string
  startTime: string
  endTime: string
  location?: string
  sessionType?: ClassSession["sessionType"]
  replacesSessionId?: string | null
  /** Defaults to "makeup" when linked, else "additional". */
  relevance?: ClassSession["relevance"]
  countsTowardAttendance?: boolean
  note?: string
}): Promise<ClassSession> {
  const stamp = new Date().toISOString()
  const id = crypto.randomUUID()
  const linked = Boolean(input.replacesSessionId)
  const relevance: ClassSession["relevance"] =
    input.relevance ?? (linked ? "makeup" : "additional")
  const isSub = relevance === "substitution"
  const session: ClassSession = {
    id,
    occurrenceKey: extraOccurrenceKey(id),
    subjectId: input.subjectId,
    seriesId: null,
    originalStart: null,
    startsAt: localDateTimeIso(input.date, input.startTime),
    endsAt: localDateTimeIso(input.date, input.endTime),
    location: input.location,
    sessionType: input.sessionType ?? "lecture",
    source: isSub ? "substitution" : linked ? "one_off" : "extra",
    status: "scheduled",
    countsTowardAttendance: input.countsTowardAttendance ?? true,
    relevance,
    replacesSessionId: input.replacesSessionId ?? null,
    note: input.note,
    createdAt: stamp,
    updatedAt: stamp,
  }
  await putSession(session)
  return session
}

/** Cancel a single materialized session (marks protected via status). */
export async function cancelSessionOccurrence(
  sessionId: string,
  reason?: string,
): Promise<ClassSession | null> {
  const existing = await db.classSessions.get(sessionId)
  if (!existing) return null
  const stamp = new Date().toISOString()
  if (existing.seriesId) {
    const date = existing.occurrenceKey.split("#")[1]
    if (date) {
      await upsertException({
        seriesId: existing.seriesId,
        date,
        type: "cancelled",
        reason,
      })
      await materializeSessions({ from: date, to: date })
      return (await db.classSessions.get(sessionId)) ?? null
    }
  }
  const next: ClassSession = {
    ...existing,
    status: "cancelled",
    countsTowardAttendance: false,
    note: reason ?? existing.note,
    updatedAt: stamp,
  }
  await putSession(next)
  return next
}
