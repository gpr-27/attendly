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
 * One-time: move pre-Clerk `AttendlyDB` into the first signed-in user's DB
 * when their DB is empty.
 */
async function maybeMigrateLegacy(
  userId: string,
  target: AttendanceDatabase,
): Promise<void> {
  if (typeof window === "undefined") return
  const claimKey = "attendly.legacyDbClaimedBy"
  const claimed = window.localStorage.getItem(claimKey)
  if (claimed && claimed !== userId) return

  const legacy = createAttendanceDatabase(LEGACY_DB_NAME)
  try {
    await legacy.open()
    const legacySubjects = await legacy.subjects.count()
    if (legacySubjects === 0) return

    await target.open()
    const targetSubjects = await target.subjects.count()
    if (targetSubjects > 0) {
      if (!claimed) window.localStorage.setItem(claimKey, userId)
      return
    }

    await copyAllTables(legacy, target)
    window.localStorage.setItem(claimKey, userId)
  } catch {
    /* ignore migrate failures — start empty */
  } finally {
    try {
      legacy.close()
    } catch {
      /* ignore */
    }
  }
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
