import type { ImpactPreview } from "./types";
import { calculatePercentage } from "./bunk-math";

/** Round for display (one decimal). */
export function formatPct(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  return `${rounded}%`;
}

/**
 * Next-class skip vs attend percentages.
 * Skip → A/(T+1); Attend → (A+1)/(T+1).
 */
export function nextClassImpact(
  attended: number,
  total: number,
): { skipPercentage: number; attendPercentage: number } {
  const skipPercentage = calculatePercentage(attended, total + 1) ?? 0;
  const attendPercentage = calculatePercentage(attended + 1, total + 1) ?? 0;
  return { skipPercentage, attendPercentage };
}

/**
 * "Skip DSA → 74.2% · Attend → 76.1%"
 */
export function impactLine(
  subjectLabel: string,
  attended: number,
  total: number,
  digits = 1,
): ImpactPreview {
  const { skipPercentage, attendPercentage } = nextClassImpact(attended, total);
  const line = `Skip ${subjectLabel} → ${formatPct(skipPercentage, digits)} · Attend → ${formatPct(attendPercentage, digits)}`;
  return { skipPercentage, attendPercentage, line };
}
