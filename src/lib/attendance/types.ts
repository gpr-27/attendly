/** Attendance mark on a class session. */
export type AttendanceMarkStatus =
  | "present"
  | "absent"
  | "late"
  | "excused"
  | "on_duty";

/** Session lifecycle that can exclude a class from the denominator. */
export type SessionLifecycleStatus =
  | "scheduled"
  | "held"
  | "cancelled"
  | "holiday"
  | "rescheduled";

/**
 * How On Duty / excused marks affect totals.
 * - present: counts as attended (A+1, T+1)
 * - absent: counts as missed (A+0, T+1)
 * - exclude: left out of both (A+0, T+0) — default college-friendly OD
 */
export type OdCountsAs = "present" | "absent" | "exclude";

/** Traffic-light standing vs college min + personal buffer. */
export type RiskBand = "Safe" | "Warning" | "Critical";

export type AttendanceCounts = {
  /** Classes credited as attended. */
  attended: number;
  /** Classes that count toward the denominator. */
  total: number;
};

export type TargetSettings = {
  /** College minimum percent, e.g. 75. */
  collegeTargetPct: number;
  /** Extra personal buffer points, e.g. 2 → effective 77. */
  bufferPct: number;
};

export type MarkContribution = {
  attendedDelta: 0 | 1;
  totalDelta: 0 | 1;
};

export type SubjectStanding = {
  attended: number;
  total: number;
  /** null when total is 0. */
  percentage: number | null;
  collegeTargetPct: number;
  bufferPct: number;
  /** collegeTargetPct + bufferPct. */
  effectiveTargetPct: number;
  /** Classes you can bunk forever while staying at effective target (ignores term end). */
  classesYouCanSkip: number;
  /** Classes you must attend in a row to reach effective target. */
  classesToRecover: number;
  /** Upcoming countable sessions used for term-bounded bunk math (0 if unknown). */
  remainingClasses: number;
  /** Term-bounded: max skips among `remainingClasses`. */
  canSkipThisTerm: number;
  /** Term-bounded: must-attend capped by remaining; null if impossible before term end. */
  mustAttendThisTerm: number | null;
  risk: RiskBand;
};

export type ImpactPreview = {
  /** % if next class is skipped (absent). */
  skipPercentage: number;
  /** % if next class is attended. */
  attendPercentage: number;
  /** Ready-to-show line, e.g. "Skip DSA → 74.2% · Attend → 76.1%". */
  line: string;
};
