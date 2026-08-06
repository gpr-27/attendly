import type {
  AttendanceRecord,
  CalendarBlock,
  ClassSession,
  SeriesException,
  Settings,
  Subject,
  TimetableSeries,
} from "@/lib/db/types";
import type { CloudSnapshot } from "./snapshot";

type WithUpdatedAt = { id: string; updatedAt?: string };

function mergeById<T extends WithUpdatedAt>(remote: T[], local: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of remote) map.set(row.id, row);
  for (const row of local) {
    const existing = map.get(row.id);
    // Cloud wins on tie — local only overrides when strictly newer.
    if (!existing || (row.updatedAt ?? "") > (existing.updatedAt ?? "")) {
      map.set(row.id, row);
    }
  }
  return [...map.values()];
}

function mergeAttendanceRecords(
  remote: AttendanceRecord[],
  local: AttendanceRecord[],
): AttendanceRecord[] {
  const bySession = new Map<string, AttendanceRecord>();
  for (const row of remote) bySession.set(row.sessionId, row);
  for (const row of local) {
    const existing = bySession.get(row.sessionId);
    if (!existing || row.markedAt >= existing.markedAt) {
      bySession.set(row.sessionId, row);
    }
  }
  return [...bySession.values()];
}

function mergeClassSessions(
  remote: ClassSession[],
  local: ClassSession[],
  markedSessionIds: Set<string>,
): ClassSession[] {
  const byId = new Map<string, ClassSession>();
  const byOccurrenceKey = new Map<string, ClassSession>();

  function consider(session: ClassSession) {
    const existingByKey = byOccurrenceKey.get(session.occurrenceKey);
    if (!existingByKey) {
      byOccurrenceKey.set(session.occurrenceKey, session);
    } else {
      const existingMarked = markedSessionIds.has(existingByKey.id);
      const candidateMarked = markedSessionIds.has(session.id);
      if (candidateMarked && !existingMarked) {
        byOccurrenceKey.set(session.occurrenceKey, session);
      } else if (!existingMarked && !candidateMarked) {
        if (session.updatedAt > existingByKey.updatedAt) {
          byOccurrenceKey.set(session.occurrenceKey, session);
        }
      } else if (candidateMarked && existingMarked) {
        if (session.updatedAt > existingByKey.updatedAt) {
          byOccurrenceKey.set(session.occurrenceKey, session);
        }
      }
    }

    const existingById = byId.get(session.id);
    if (!existingById || session.updatedAt > existingById.updatedAt) {
      byId.set(session.id, session);
    }
  }

  for (const session of remote) consider(session);
  for (const session of local) consider(session);

  const merged = new Map<string, ClassSession>();
  for (const session of byOccurrenceKey.values()) {
    merged.set(session.id, session);
  }

  // Keep marked sessions even when occurrenceKey dedup picked a sibling row.
  for (const sessionId of markedSessionIds) {
    if (merged.has(sessionId)) continue;
    const session =
      byId.get(sessionId) ??
      local.find((s) => s.id === sessionId) ??
      remote.find((s) => s.id === sessionId);
    if (session) merged.set(session.id, session);
  }

  return [...merged.values()];
}

function mergeSettings(
  remote: Settings | null,
  local: Settings | null,
): Settings | null {
  if (!remote) return local;
  if (!local) return remote;
  return (local.updatedAt ?? "") > (remote.updatedAt ?? "") ? local : remote;
}

/**
 * Merge a remote cloud snapshot with unsynced local Dexie state.
 * Attendance always unions (newer markedAt wins). Sessions referenced by
 * marks are preserved even when occurrence keys collide across devices.
 */
export function mergeSnapshots(
  remote: CloudSnapshot,
  local: CloudSnapshot,
): CloudSnapshot {
  const attendanceRecords = mergeAttendanceRecords(
    remote.attendanceRecords,
    local.attendanceRecords,
  );
  const markedSessionIds = new Set(attendanceRecords.map((r) => r.sessionId));

  return {
    settings: mergeSettings(remote.settings, local.settings),
    subjects: mergeById<Subject>(remote.subjects, local.subjects),
    timetableSeries: mergeById<TimetableSeries>(
      remote.timetableSeries,
      local.timetableSeries,
    ),
    seriesExceptions: mergeById<SeriesException>(
      remote.seriesExceptions,
      local.seriesExceptions,
    ),
    calendarBlocks: mergeById<CalendarBlock>(
      remote.calendarBlocks,
      local.calendarBlocks,
    ),
    classSessions: mergeClassSessions(
      remote.classSessions,
      local.classSessions,
      markedSessionIds,
    ),
    attendanceRecords,
  };
}

/** True when local has attendance rows missing or older on the remote snapshot. */
export function localHasUnsyncedAttendance(
  local: CloudSnapshot,
  remote: CloudSnapshot,
): boolean {
  const remoteBySession = new Map(
    remote.attendanceRecords.map((r) => [r.sessionId, r]),
  );
  for (const row of local.attendanceRecords) {
    const remoteRow = remoteBySession.get(row.sessionId);
    if (!remoteRow || row.markedAt > remoteRow.markedAt) return true;
  }
  return false;
}
