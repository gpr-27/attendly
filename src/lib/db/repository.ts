import { scheduleCloudPush, syncCriticalToCloud } from "./cloud-sync"
import { db } from "./database"
import {
  SETTINGS_ID,
  defaultSettings,
  type AttendanceRecord,
  type AttendanceStatus,
  type CalendarBlock,
  type ClassSession,
  type SeriesException,
  type Settings,
  type Subject,
  type TimetableSeries,
  type WeekParity,
} from "./types"

function nowIso(): string {
  return new Date().toISOString()
}

function newId(): string {
  return crypto.randomUUID()
}

function touchCloud() {
  scheduleCloudPush()
}

/** Await cloud push for attendance-critical mutations (marks, settings). */
async function touchCloudCritical() {
  await syncCriticalToCloud()
}

function allTables() {
  return [
    db.settings,
    db.subjects,
    db.timetableSeries,
    db.seriesExceptions,
    db.calendarBlocks,
    db.classSessions,
    db.attendanceRecords,
  ] as const
}

// —— Settings ——

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get(SETTINGS_ID)
  if (!row) return defaultSettings()
  // Merge defaults so older Dexie rows pick up new notification / period fields.
  const defaults = defaultSettings()
  const merged: Settings = { ...defaults, ...row, id: SETTINGS_ID }
  // Empty or missing periodSlots → college defaults (do not keep []).
  if (!row.periodSlots || row.periodSlots.length === 0) {
    merged.periodSlots = defaults.periodSlots
  }
  return merged
}

export async function saveSettings(
  patch: Partial<Omit<Settings, "id">>,
): Promise<Settings> {
  const current = await getSettings()
  const next: Settings = {
    ...current,
    ...patch,
    id: SETTINGS_ID,
    updatedAt: nowIso(),
  }
  await db.settings.put(next)
  await touchCloudCritical()
  return next
}

// —— Subjects ——

export async function listSubjects(): Promise<Subject[]> {
  return db.subjects.orderBy("shortCode").toArray()
}

export async function getSubject(id: string): Promise<Subject | undefined> {
  return db.subjects.get(id)
}

export async function addSubject(
  input: Omit<Subject, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<Subject> {
  const stamp = nowIso()
  const subject: Subject = {
    id: input.id ?? newId(),
    name: input.name,
    shortCode: input.shortCode,
    color: input.color,
    targetPct: input.targetPct,
    archived: input.archived ?? false,
    createdAt: stamp,
    updatedAt: stamp,
  }
  await db.subjects.add(subject)
  touchCloud()
  return subject
}

export async function updateSubject(
  id: string,
  patch: Partial<Omit<Subject, "id" | "createdAt">>,
): Promise<Subject> {
  const existing = await db.subjects.get(id)
  if (!existing) throw new Error(`Subject not found: ${id}`)
  const next: Subject = { ...existing, ...patch, id, updatedAt: nowIso() }
  await db.subjects.put(next)
  touchCloud()
  return next
}

/**
 * Permanently remove a subject and cascade: weekly series + exceptions,
 * all class sessions for that subject (past/future/extras), and their marks.
 */
export async function deleteSubject(id: string): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.subjects,
      db.timetableSeries,
      db.seriesExceptions,
      db.classSessions,
      db.attendanceRecords,
    ],
    async () => {
      const seriesRows = await db.timetableSeries
        .where("subjectId")
        .equals(id)
        .toArray()
      const seriesIds = seriesRows.map((s) => String(s.id))
      if (seriesIds.length > 0) {
        await db.seriesExceptions.where("seriesId").anyOf(seriesIds).delete()
        await db.timetableSeries.where("subjectId").equals(id).delete()
      }

      const sessions = await db.classSessions
        .where("subjectId")
        .equals(id)
        .toArray()
      const sessionIds = sessions.map((s) => String(s.id))
      if (sessionIds.length > 0) {
        await db.attendanceRecords.where("sessionId").anyOf(sessionIds).delete()
        await db.classSessions.where("subjectId").equals(id).delete()
      }

      await db.subjects.delete(id)
    },
  )
  await touchCloudCritical()
}

// —— Timetable series ——

export async function listSeries(): Promise<TimetableSeries[]> {
  return db.timetableSeries.toArray()
}

export async function listSeriesBySubject(
  subjectId: string,
): Promise<TimetableSeries[]> {
  return db.timetableSeries.where("subjectId").equals(subjectId).toArray()
}

export async function getSeries(
  id: string,
): Promise<TimetableSeries | undefined> {
  return db.timetableSeries.get(id)
}

export async function addSeries(
  input: Omit<TimetableSeries, "id" | "createdAt" | "updatedAt"> & {
    id?: string
  },
): Promise<TimetableSeries> {
  const stamp = nowIso()
  const weekParity: WeekParity = input.weekParity ?? "all"
  const series: TimetableSeries = {
    id: input.id ?? newId(),
    subjectId: input.subjectId,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    sessionType: input.sessionType,
    targetPct: input.targetPct,
    weekParity,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    countsTowardAttendance: input.countsTowardAttendance ?? true,
    createdAt: stamp,
    updatedAt: stamp,
  }
  await db.timetableSeries.add(series)
  touchCloud()
  return series
}

export async function updateSeries(
  id: string,
  patch: Partial<Omit<TimetableSeries, "id" | "createdAt">>,
): Promise<TimetableSeries> {
  const existing = await db.timetableSeries.get(id)
  if (!existing) throw new Error(`Series not found: ${id}`)
  const next: TimetableSeries = {
    ...existing,
    ...patch,
    id,
    updatedAt: nowIso(),
  }
  await db.timetableSeries.put(next)
  touchCloud()
  return next
}

export async function deleteSeries(id: string): Promise<void> {
  await db.transaction("rw", db.timetableSeries, db.seriesExceptions, async () => {
    await db.seriesExceptions.where("seriesId").equals(id).delete()
    await db.timetableSeries.delete(id)
  })
  touchCloud()
}

// —— Series exceptions ——

export async function listExceptions(): Promise<SeriesException[]> {
  return db.seriesExceptions.toArray()
}

export async function listExceptionsForSeries(
  seriesId: string,
): Promise<SeriesException[]> {
  return db.seriesExceptions.where("seriesId").equals(seriesId).toArray()
}

export async function upsertException(
  input: Omit<SeriesException, "id" | "createdAt"> & { id?: string },
): Promise<SeriesException> {
  const existing = await db.seriesExceptions
    .where("[seriesId+date]")
    .equals([input.seriesId, input.date])
    .first()

  if (existing) {
    const next: SeriesException = {
      ...existing,
      type: input.type,
      newStartTime: input.newStartTime,
      newEndTime: input.newEndTime,
      newLocation: input.newLocation,
      reason: input.reason,
    }
    await db.seriesExceptions.put(next)
    touchCloud()
    return next
  }

  const row: SeriesException = {
    id: input.id ?? newId(),
    seriesId: input.seriesId,
    date: input.date,
    type: input.type,
    newStartTime: input.newStartTime,
    newEndTime: input.newEndTime,
    newLocation: input.newLocation,
    reason: input.reason,
    createdAt: nowIso(),
  }
  await db.seriesExceptions.add(row)
  touchCloud()
  return row
}

export async function deleteException(id: string): Promise<void> {
  await db.seriesExceptions.delete(id)
  touchCloud()
}

/** Remove the exception for one series occurrence (if any). */
export async function deleteExceptionForOccurrence(
  seriesId: string,
  date: string,
): Promise<boolean> {
  const existing = await db.seriesExceptions
    .where("[seriesId+date]")
    .equals([seriesId, date])
    .first()
  if (!existing) return false
  await db.seriesExceptions.delete(existing.id)
  touchCloud()
  return true
}

// —— Calendar blocks ——

export async function listCalendarBlocks(): Promise<CalendarBlock[]> {
  return db.calendarBlocks.orderBy("startsOn").toArray()
}

export async function addCalendarBlock(
  input: Omit<CalendarBlock, "id" | "createdAt"> & { id?: string },
): Promise<CalendarBlock> {
  const block: CalendarBlock = {
    id: input.id ?? newId(),
    kind: input.kind,
    title: input.title,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    suppressesTeaching: input.suppressesTeaching ?? true,
    createdAt: nowIso(),
  }
  await db.calendarBlocks.add(block)
  touchCloud()
  return block
}

export async function updateCalendarBlock(
  id: string,
  patch: Partial<Omit<CalendarBlock, "id" | "createdAt">>,
): Promise<CalendarBlock> {
  const existing = await db.calendarBlocks.get(id)
  if (!existing) throw new Error(`Calendar block not found: ${id}`)
  const next: CalendarBlock = { ...existing, ...patch, id }
  await db.calendarBlocks.put(next)
  touchCloud()
  return next
}

export async function deleteCalendarBlock(id: string): Promise<void> {
  await db.calendarBlocks.delete(id)
  touchCloud()
}

// —— Class sessions ——

export async function listSessions(): Promise<ClassSession[]> {
  return db.classSessions.orderBy("startsAt").toArray()
}

export async function listSessionsInRange(
  fromIso: string,
  toIso: string,
): Promise<ClassSession[]> {
  return db.classSessions
    .where("startsAt")
    .between(fromIso, toIso, true, true)
    .toArray()
}

export async function getSession(
  id: string,
): Promise<ClassSession | undefined> {
  return db.classSessions.get(id)
}

export async function getSessionByOccurrenceKey(
  occurrenceKey: string,
): Promise<ClassSession | undefined> {
  return db.classSessions.where("occurrenceKey").equals(occurrenceKey).first()
}

export async function putSession(session: ClassSession): Promise<string> {
  await db.classSessions.put(session)
  touchCloud()
  return session.id
}

/** Deletes only if no attendance mark exists. */
export async function deleteSessionIfUnmarked(id: string): Promise<boolean> {
  const mark = await db.attendanceRecords.where("sessionId").equals(id).first()
  if (mark) return false
  await db.classSessions.delete(id)
  touchCloud()
  return true
}

// —— Attendance ——

export async function listAttendance(): Promise<AttendanceRecord[]> {
  return db.attendanceRecords.orderBy("markedAt").reverse().toArray()
}

export async function getAttendanceForSession(
  sessionId: string,
): Promise<AttendanceRecord | undefined> {
  return db.attendanceRecords.where("sessionId").equals(sessionId).first()
}

export async function markAttendance(
  sessionId: string,
  status: AttendanceStatus,
  note?: string,
): Promise<AttendanceRecord> {
  const existing = await getAttendanceForSession(sessionId)
  if (existing) {
    const next: AttendanceRecord = {
      ...existing,
      status,
      note,
      markedAt: nowIso(),
    }
    await db.attendanceRecords.put(next)
    touchCloud()
    return next
  }
  const row: AttendanceRecord = {
    id: newId(),
    sessionId,
    status,
    markedAt: nowIso(),
    note,
  }
  await db.attendanceRecords.add(row)
  touchCloud()
  return row
}

export async function clearAttendance(sessionId: string): Promise<void> {
  const row = await getAttendanceForSession(sessionId)
  if (row) {
    await db.attendanceRecords.delete(row.id)
    touchCloud()
  }
}

export async function sessionIdsWithMarks(
  sessionIds: string[],
): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set()
  const rows = await db.attendanceRecords
    .where("sessionId")
    .anyOf(sessionIds)
    .toArray()
  return new Set(rows.map((r) => r.sessionId))
}

/** Wipe all stores. Stays empty — no re-seed. */
export async function clearAllData(): Promise<void> {
  const tables = allTables()
  await db.transaction("rw", [...tables], async () => {
    await Promise.all(tables.map((t) => t.clear()))
  })
  // Caller (import / settings wipe) should scheduleCloudPush when done.
}
