import type { SubjectStanding, TargetSettings } from "./types";
import { riskBand } from "./risk";

/** Fraction p from percent (clamped to (0, 1)). */
function targetFraction(targetPct: number): number {
  return Math.min(Math.max(targetPct, 0), 100) / 100;
}

/** College min + personal buffer (e.g. 75 + 2 → 77). */
export function effectiveTargetPct(
  collegeTargetPct: number,
  bufferPct: number,
): number {
  return collegeTargetPct + bufferPct;
}

/**
 * % = A / T × 100. Returns null when no countable classes yet.
 */
export function calculatePercentage(
  attended: number,
  total: number,
): number | null {
  if (total <= 0) return null;
  return (attended / total) * 100;
}

/**
 * How many future classes you can skip and still sit at target p,
 * ignoring a fixed term length: floor(A/p − T).
 */
export function classesYouCanSkip(
  attended: number,
  total: number,
  targetPct: number,
): number {
  const p = targetFraction(targetPct);
  if (p <= 0) return Number.POSITIVE_INFINITY;
  if (p >= 1) return 0;
  if (attended < p * total) return 0;
  return Math.max(0, Math.floor(attended / p - total + 1e-9));
}

/**
 * Consecutive classes you must attend to reach target:
 * ceil((p·T − A) / (1 − p)).
 */
export function classesToRecover(
  attended: number,
  total: number,
  targetPct: number,
): number {
  const p = targetFraction(targetPct);
  if (p <= 0) return 0;
  if (p >= 1) {
    // Need 100%: only possible if already perfect and no absences remain.
    return attended >= total && total >= 0 ? 0 : Number.POSITIVE_INFINITY;
  }
  const deficit = p * total - attended;
  if (deficit <= 1e-9) return 0;
  return Math.max(0, Math.ceil(deficit / (1 - p) - 1e-9));
}

/**
 * Max skips among `remainingClasses` while finishing at/above target.
 * S ≤ A + R − p(T + R), clamped to [0, R].
 */
export function canSkipThisTerm(
  attended: number,
  total: number,
  remainingClasses: number,
  targetPct: number,
): number {
  const R = Math.max(0, Math.floor(remainingClasses));
  if (R === 0) return 0;
  const p = targetFraction(targetPct);
  if (p <= 0) return R;
  if (p >= 1) return 0;
  const raw = Math.floor(attended + R - p * (total + R) + 1e-9);
  return Math.max(0, Math.min(R, raw));
}

/**
 * Must-attend count capped by remaining classes.
 * Returns null when you cannot reach target before term end.
 */
export function mustAttendThisTerm(
  attended: number,
  total: number,
  remainingClasses: number,
  targetPct: number,
): number | null {
  const R = Math.max(0, Math.floor(remainingClasses));
  const need = classesToRecover(attended, total, targetPct);
  if (!Number.isFinite(need)) return R === 0 && attended >= total ? 0 : null;
  if (need === 0) return 0;
  if (need > R) return null;
  return need;
}

/**
 * Full standing snapshot for one subject (or overall).
 * Uses effective target (college + buffer) for bunk/recovery math.
 */
export function calculateSubjectStanding(
  attended: number,
  total: number,
  settings: TargetSettings,
  remainingClasses = 0,
): SubjectStanding {
  const { collegeTargetPct, bufferPct } = settings;
  const effective = effectiveTargetPct(collegeTargetPct, bufferPct);
  const percentage = calculatePercentage(attended, total);
  const remaining = Math.max(0, Math.floor(remainingClasses));

  return {
    attended,
    total,
    percentage,
    collegeTargetPct,
    bufferPct,
    effectiveTargetPct: effective,
    classesYouCanSkip: classesYouCanSkip(attended, total, effective),
    classesToRecover: classesToRecover(attended, total, effective),
    remainingClasses: remaining,
    canSkipThisTerm: canSkipThisTerm(attended, total, remaining, effective),
    mustAttendThisTerm: mustAttendThisTerm(
      attended,
      total,
      remaining,
      effective,
    ),
    risk: riskBand(percentage, collegeTargetPct, bufferPct),
  };
}
