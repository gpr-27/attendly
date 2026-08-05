import type { WeekParity } from "@/lib/db"

/**
 * ISO-8601 week number (weeks start Monday; week 1 has the year's first Thursday).
 * Uses local calendar date parts from YYYY-MM-DD.
 */
export function isoWeekNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function matchesWeekParity(
  ymd: string,
  parity: WeekParity | undefined | null,
): boolean {
  if (!parity || parity === "all") return true
  const week = isoWeekNumber(ymd)
  const odd = week % 2 === 1
  return parity === "odd" ? odd : !odd
}
