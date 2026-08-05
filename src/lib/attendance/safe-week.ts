import { calculatePercentage, classesYouCanSkip } from "./bunk-math";
import { riskBand } from "./risk";
import { teachingSuppressedOn, type CalendarBlockLike } from "./projection";
import type { RiskBand } from "./types";

export type SafeWeekSession = {
  subjectId: string;
  startsAt: string;
  status: string;
  countsTowardAttendance?: boolean;
};

export type SafeWeekSubjectInput = {
  id: string;
  shortCode: string;
  name: string;
  color: string;
  attended: number;
  total: number;
  collegeTargetPct: number;
};

export type SafeWeekImpact = {
  subjectId: string;
  shortCode: string;
  name: string;
  color: string;
  missedClasses: number;
  currentPct: number | null;
  afterMissPct: number | null;
  pctDrop: number | null;
  riskAfter: RiskBand;
  canStillSkip: number;
  effectiveTargetPct: number;
};

function ymdFromIso(iso: string): string {
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return iso.slice(0, 10);
}

function compareYmd(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sessionIsCountable(session: SafeWeekSession): boolean {
  if (session.countsTowardAttendance === false) return false;
  if (session.status === "cancelled" || session.status === "holiday") {
    return false;
  }
  return true;
}

/** Countable sessions whose local date falls in [fromYmd, toYmd]. */
export function sessionsInDateRange(
  sessions: SafeWeekSession[],
  fromYmd: string,
  toYmd: string,
  calendarBlocks: CalendarBlockLike[] = [],
): SafeWeekSession[] {
  return sessions.filter((session) => {
    if (!sessionIsCountable(session)) return false;
    const date = ymdFromIso(session.startsAt);
    if (compareYmd(date, fromYmd) < 0 || compareYmd(date, toYmd) > 0) {
      return false;
    }
    // Already-suppressed teaching days shouldn't appear as "missable"
    if (teachingSuppressedOn(date, calendarBlocks)) return false;
    return true;
  });
}

/**
 * Per-subject impact if every countable class in the range is missed.
 * Pure — no Dexie. Pass real sessions from the planner UI.
 */
export function safeWeekImpact(args: {
  subjects: SafeWeekSubjectInput[];
  sessionsInRange: SafeWeekSession[];
  bufferPct: number;
}): SafeWeekImpact[] {
  const missBySubject = new Map<string, number>();
  for (const session of args.sessionsInRange) {
    if (!sessionIsCountable(session)) continue;
    missBySubject.set(
      session.subjectId,
      (missBySubject.get(session.subjectId) ?? 0) + 1,
    );
  }

  const rows: SafeWeekImpact[] = [];
  for (const subject of args.subjects) {
    const missed = missBySubject.get(subject.id) ?? 0;
    if (missed === 0) continue;

    const effective = subject.collegeTargetPct + args.bufferPct;
    const currentPct = calculatePercentage(subject.attended, subject.total);
    const afterMissPct = calculatePercentage(
      subject.attended,
      subject.total + missed,
    );
    const pctDrop =
      currentPct == null || afterMissPct == null
        ? null
        : currentPct - afterMissPct;

    rows.push({
      subjectId: subject.id,
      shortCode: subject.shortCode,
      name: subject.name,
      color: subject.color,
      missedClasses: missed,
      currentPct,
      afterMissPct,
      pctDrop,
      riskAfter: riskBand(
        afterMissPct,
        subject.collegeTargetPct,
        args.bufferPct,
      ),
      canStillSkip: classesYouCanSkip(
        subject.attended,
        subject.total + missed,
        effective,
      ),
      effectiveTargetPct: effective,
    });
  }

  rows.sort((a, b) => {
    const ap = a.afterMissPct ?? 999;
    const bp = b.afterMissPct ?? 999;
    return ap - bp;
  });
  return rows;
}
