import type {
  AttendanceMarkStatus,
  MarkContribution,
  OdCountsAs,
  SessionLifecycleStatus,
} from "./types";

const EXCLUDED_SESSION_STATUSES = new Set<SessionLifecycleStatus>([
  "cancelled",
  "holiday",
]);

/**
 * Cancelled / holiday (and explicit flag) never enter A or T.
 */
export function sessionCountsTowardAttendance(session: {
  status?: SessionLifecycleStatus | string;
  countsTowardAttendance?: boolean;
}): boolean {
  if (session.countsTowardAttendance === false) return false;
  if (
    session.status &&
    EXCLUDED_SESSION_STATUSES.has(session.status as SessionLifecycleStatus)
  ) {
    return false;
  }
  return true;
}

/**
 * Pure check: is this lifecycle status excluded from attendance math?
 */
export function isExcludedSessionStatus(
  status: SessionLifecycleStatus | string,
): boolean {
  return EXCLUDED_SESSION_STATUSES.has(status as SessionLifecycleStatus);
}

/**
 * How one mark moves attended/total, given OD policy.
 * Default OD/excused = exclude (does not lower % like Absent).
 */
export function markContribution(
  status: AttendanceMarkStatus,
  odCountsAs: OdCountsAs = "exclude",
): MarkContribution {
  switch (status) {
    case "present":
    case "late":
      return { attendedDelta: 1, totalDelta: 1 };
    case "absent":
      return { attendedDelta: 0, totalDelta: 1 };
    case "on_duty":
    case "excused":
      if (odCountsAs === "present") return { attendedDelta: 1, totalDelta: 1 };
      if (odCountsAs === "absent") return { attendedDelta: 0, totalDelta: 1 };
      return { attendedDelta: 0, totalDelta: 0 };
  }
}

/**
 * Sum A and T from marks, skipping sessions that do not count.
 */
export function countAttendanceFromMarks(
  rows: Array<{
    markStatus: AttendanceMarkStatus;
    sessionStatus?: SessionLifecycleStatus | string;
    countsTowardAttendance?: boolean;
  }>,
  odCountsAs: OdCountsAs = "exclude",
): { attended: number; total: number } {
  let attended = 0;
  let total = 0;

  for (const row of rows) {
    if (
      !sessionCountsTowardAttendance({
        status: row.sessionStatus,
        countsTowardAttendance: row.countsTowardAttendance,
      })
    ) {
      continue;
    }
    const delta = markContribution(row.markStatus, odCountsAs);
    attended += delta.attendedDelta;
    total += delta.totalDelta;
  }

  return { attended, total };
}
