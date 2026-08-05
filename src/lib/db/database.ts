import Dexie, { type EntityTable } from "dexie"
import type {
  AttendanceRecord,
  CalendarBlock,
  ClassSession,
  SeriesException,
  Settings,
  Subject,
  TimetableSeries,
} from "./types"

export type AttendanceDatabase = Dexie & {
  settings: EntityTable<Settings, "id">
  subjects: EntityTable<Subject, "id">
  timetableSeries: EntityTable<TimetableSeries, "id">
  seriesExceptions: EntityTable<SeriesException, "id">
  calendarBlocks: EntityTable<CalendarBlock, "id">
  classSessions: EntityTable<ClassSession, "id">
  attendanceRecords: EntityTable<AttendanceRecord, "id">
}

const LEGACY_DB_NAME = "AttendlyDB"
const STORE_SCHEMA = {
  settings: "id",
  subjects: "id, shortCode",
  timetableSeries: "id, subjectId, dayOfWeek, effectiveFrom",
  seriesExceptions: "id, seriesId, date, [seriesId+date]",
  calendarBlocks: "id, kind, startsOn, endsOn",
  classSessions:
    "id, &occurrenceKey, subjectId, seriesId, startsAt, status, [subjectId+startsAt]",
  attendanceRecords: "id, &sessionId, markedAt",
} as const

/** Safe IndexedDB name segment from Clerk user id. */
export function databaseNameForUser(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120)
  return `AttendlyDB_u_${safe || "unknown"}`
}

export function createAttendanceDatabase(name: string): AttendanceDatabase {
  const instance = new Dexie(name) as AttendanceDatabase
  instance.version(1).stores({ ...STORE_SCHEMA })
  return instance
}

/**
 * Active Dexie instance. Rebound per signed-in Clerk user via
 * `bindDatabaseForUser` (live ES module binding).
 */
export let db: AttendanceDatabase = createAttendanceDatabase(
  `${LEGACY_DB_NAME}__unbound`,
)

let boundUserId: string | null = null

export function getBoundUserId(): string | null {
  return boundUserId
}

async function copyAllTables(
  from: AttendanceDatabase,
  to: AttendanceDatabase,
): Promise<void> {
  await from.open()
  await to.open()
  const tables = [
    "settings",
    "subjects",
    "timetableSeries",
    "seriesExceptions",
    "calendarBlocks",
    "classSessions",
    "attendanceRecords",
  ] as const

  await to.transaction("rw", tables as unknown as string[], async () => {
    for (const name of tables) {
      await to.table(name).clear()
      const rows = await from.table(name).toArray()
      if (rows.length > 0) await to.table(name).bulkAdd(rows)
    }
  })
}

/**
 * Pull rows from a source DB into `target` when target is empty and source
 * has subjects. Used for pre-Clerk `AttendlyDB` and the accidental
 * `AttendlyDB__unbound` bucket (stale import bug).
 */
async function maybeAdoptSource(
  sourceName: string,
  target: AttendanceDatabase,
  claimKey: string,
  userId: string,
): Promise<void> {
  if (typeof window === "undefined") return
  const claimed = window.localStorage.getItem(claimKey)
  if (claimed && claimed !== userId && claimed !== "shared-unbound") return

  const source = createAttendanceDatabase(sourceName)
  try {
    await source.open()
    const sourceSubjects = await source.subjects.count()
    if (sourceSubjects === 0) return

    await target.open()
    const targetSubjects = await target.subjects.count()
    if (targetSubjects > 0) {
      if (!claimed) window.localStorage.setItem(claimKey, userId)
      return
    }

    await copyAllTables(source, target)
    window.localStorage.setItem(claimKey, userId)
    // Empty the accidental unbound bucket so it cannot shadow later.
    if (sourceName.endsWith("__unbound")) {
      await source.transaction(
        "rw",
        [
          source.settings,
          source.subjects,
          source.timetableSeries,
          source.seriesExceptions,
          source.calendarBlocks,
          source.classSessions,
          source.attendanceRecords,
        ],
        async () => {
          await Promise.all([
            source.settings.clear(),
            source.subjects.clear(),
            source.timetableSeries.clear(),
            source.seriesExceptions.clear(),
            source.calendarBlocks.clear(),
            source.classSessions.clear(),
            source.attendanceRecords.clear(),
          ])
        },
      )
    }
  } catch {
    /* ignore migrate failures — start empty */
  } finally {
    try {
      source.close()
    } catch {
      /* ignore */
    }
  }
}

async function maybeMigrateLegacy(
  userId: string,
  target: AttendanceDatabase,
): Promise<void> {
  await maybeAdoptSource(
    LEGACY_DB_NAME,
    target,
    "attendly.legacyDbClaimedBy",
    userId,
  )
  await maybeAdoptSource(
    `${LEGACY_DB_NAME}__unbound`,
    target,
    "attendly.unboundDbClaimedBy",
    userId,
  )
}

/**
 * Point the shared `db` export at this Clerk user's IndexedDB.
 * Call before any repository reads after sign-in / account switch.
 */
export async function bindDatabaseForUser(userId: string): Promise<void> {
  if (!userId) throw new Error("bindDatabaseForUser: missing userId")
  const name = databaseNameForUser(userId)
  if (boundUserId === userId && db.name === name) return

  try {
    db.close()
  } catch {
    /* not open yet */
  }

  const next = createAttendanceDatabase(name)
  await next.open()
  await maybeMigrateLegacy(userId, next)
  db = next
  boundUserId = userId
}

export default db
