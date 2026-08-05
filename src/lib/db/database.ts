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

/**
 * Attendly IndexedDB.
 * Fresh install = empty stores (no populate / seed hooks).
 * Data appears only when the user or Gemini import writes it.
 */
export const db = new Dexie("AttendlyDB") as AttendanceDatabase

db.version(1).stores({
  settings: "id",
  subjects: "id, shortCode",
  timetableSeries: "id, subjectId, dayOfWeek, effectiveFrom",
  seriesExceptions: "id, seriesId, date, [seriesId+date]",
  calendarBlocks: "id, kind, startsOn, endsOn",
  classSessions:
    "id, &occurrenceKey, subjectId, seriesId, startsAt, status, [subjectId+startsAt]",
  attendanceRecords: "id, &sessionId, markedAt",
})

export default db
