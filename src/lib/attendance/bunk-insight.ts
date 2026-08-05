import type { SubjectStanding } from "./types";

/**
 * Real-time forward-looking bunk line for Today / Subjects / Plan.
 * Prefers term-bounded Rem over infinite-horizon skips (which often read 0 early).
 */
export function formatBunkInsight(standing: SubjectStanding): string {
  const rem = standing.remainingClasses;

  if (standing.total === 0 && rem <= 0) {
    return "No marks yet";
  }

  if (rem <= 0) {
    return "Add timetable / check semester end dates to unlock bunk forecast";
  }

  const pctLabel =
    standing.percentage == null
      ? "—"
      : `${Math.round(standing.percentage)}%`;

  if (
    standing.mustAttendThisTerm != null &&
    standing.mustAttendThisTerm > 0
  ) {
    return `${pctLabel} · Attend ${standing.mustAttendThisTerm} of next ${rem} to recover`;
  }

  if (standing.mustAttendThisTerm === null && standing.classesToRecover > 0) {
    return `${pctLabel} · need more than ${rem} left to reach ${standing.effectiveTargetPct}%`;
  }

  if (standing.canSkipThisTerm > 0) {
    return `${pctLabel} · can bunk ${standing.canSkipThisTerm} more (of ${rem} left)`;
  }

  return `${pctLabel} · attend all ${rem} left to stay ≥ ${standing.effectiveTargetPct}%`;
}
