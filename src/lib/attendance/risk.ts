import type { RiskBand } from "./types";

/**
 * Traffic-light vs college minimum and personal buffer target.
 * - Critical: below college min
 * - Warning: at/above college min but below college+buffer
 * - Safe: at/above college+buffer, or no classes yet
 */
export function riskBand(
  percentage: number | null,
  collegeTargetPct: number,
  bufferPct: number,
): RiskBand {
  if (percentage === null) return "Safe";

  const buffered = collegeTargetPct + bufferPct;

  if (percentage + 1e-9 < collegeTargetPct) return "Critical";
  if (percentage + 1e-9 < buffered) return "Warning";
  return "Safe";
}
