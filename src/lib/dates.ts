/** Local calendar helpers (no timezone conversion beyond device local). */

export function ymdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayYmd(): string {
  return ymdFromDate(new Date());
}

/** Parse YYYY-MM-DD; returns null if invalid. */
export function parseYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return value;
}

export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return ymdFromDate(dt);
}

/** Local day-of-week: 0=Sun … 6=Sat (matches `Date#getDay`). */
export function dayOfWeekFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Monday of the week containing `ymd` (Mon-first college week).
 * Sunday maps to the preceding Monday.
 */
export function mondayOfWeekYmd(ymd: string): string {
  const dow = dayOfWeekFromYmd(ymd);
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDaysYmd(ymd, delta);
}

export function dayBoundsIso(ymd: string): { fromIso: string; toIso: string } {
  const [y, m, d] = ymd.split("-").map(Number);
  return {
    fromIso: new Date(y, m - 1, d, 0, 0, 0, 0).toISOString(),
    toIso: new Date(y, m - 1, d, 23, 59, 59, 999).toISOString(),
  };
}

/**
 * Local calendar day for a session.
 * Series keys are `seriesId#YYYY-MM-DD`; extras are `extra#<uuid>` — only treat
 * the suffix as a date when it matches YYYY-MM-DD, else use startsAt locally.
 */
export function sessionLocalYmd(session: {
  occurrenceKey: string;
  startsAt: string;
}): string {
  const fromKey = session.occurrenceKey.split("#")[1];
  if (fromKey && /^\d{4}-\d{2}-\d{2}$/.test(fromKey)) return fromKey;
  return ymdFromDate(new Date(session.startsAt));
}

export function formatDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function isTodayYmd(ymd: string): boolean {
  return ymd === todayYmd();
}
