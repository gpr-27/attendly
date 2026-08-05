export type {
  AttendanceCounts,
  AttendanceMarkStatus,
  ImpactPreview,
  MarkContribution,
  OdCountsAs,
  RiskBand,
  SessionLifecycleStatus,
  SubjectStanding,
  TargetSettings,
} from "./types";

export {
  calculatePercentage,
  calculateSubjectStanding,
  canSkipThisTerm,
  classesToRecover,
  classesYouCanSkip,
  effectiveTargetPct,
  mustAttendThisTerm,
} from "./bunk-math";

export { riskBand } from "./risk";

export { formatPct, impactLine, nextClassImpact } from "./impact";

export { formatBunkInsight } from "./bunk-insight";

export {
  countAttendanceFromMarks,
  isExcludedSessionStatus,
  markContribution,
  sessionCountsTowardAttendance,
} from "./session-counting";

export {
  componentKindForSessionType,
  resolveCollegeTargetPct,
  type ResolveCollegeTargetInput,
} from "./targets";

export {
  countRemainingClasses,
  isDateInBlock,
  projectAllSubjects,
  projectSemesterEnd,
  teachingSuppressedOn,
  type CalendarBlockLike,
  type CountableSession,
  type SemesterProjection,
  type SubjectProjectionRow,
} from "./projection";

export {
  safeWeekImpact,
  sessionsInDateRange,
  type SafeWeekImpact,
  type SafeWeekSession,
  type SafeWeekSubjectInput,
} from "./safe-week";

export {
  buildAnalyticsKeyPoints,
  loadSubjectStandings,
  type SubjectStandingRow,
} from "./load-subject-standings";

export {
  buildSubjectReport,
  loadSubjectReport,
  resolveSubjectReportStatus,
  subjectReportStatusLabel,
  type SubjectReport,
  type SubjectReportMarkStatus,
  type SubjectReportSessionRow,
  type SubjectReportSummary,
  type SubjectReportWeekGroup,
} from "./subject-report";
