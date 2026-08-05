import type {
  AttendanceRecord,
  CalendarBlock,
  ClassSession,
  SeriesException,
  Settings,
  Subject,
  TimetableSeries,
} from "@/lib/db/types";
import { SETTINGS_ID } from "@/lib/db/types";

/** Full per-user cloud payload (includes attendance — unlike schedule backup JSON). */
export interface CloudSnapshot {
  settings: Settings | null;
  subjects: Subject[];
  timetableSeries: TimetableSeries[];
  seriesExceptions: SeriesException[];
  calendarBlocks: CalendarBlock[];
  classSessions: ClassSession[];
  attendanceRecords: AttendanceRecord[];
}

export function emptySnapshot(): CloudSnapshot {
  return {
    settings: null,
    subjects: [],
    timetableSeries: [],
    seriesExceptions: [],
    calendarBlocks: [],
    classSessions: [],
    attendanceRecords: [],
  };
}

export function snapshotHasData(snap: CloudSnapshot): boolean {
  return Boolean(
    snap.settings ||
      snap.subjects.length ||
      snap.timetableSeries.length ||
      snap.seriesExceptions.length ||
      snap.calendarBlocks.length ||
      snap.classSessions.length ||
      snap.attendanceRecords.length,
  );
}

export function isValidCloudSnapshot(body: unknown): body is CloudSnapshot {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  return (
    (o.settings === null || typeof o.settings === "object") &&
    Array.isArray(o.subjects) &&
    Array.isArray(o.timetableSeries) &&
    Array.isArray(o.seriesExceptions) &&
    Array.isArray(o.calendarBlocks) &&
    Array.isArray(o.classSessions) &&
    Array.isArray(o.attendanceRecords)
  );
}

export { SETTINGS_ID };
