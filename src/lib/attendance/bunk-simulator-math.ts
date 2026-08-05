import {
  calculatePercentage,
  calculateSubjectStanding,
  classesYouCanSkip,
  effectiveTargetPct,
} from "./bunk-math";
import { formatBunkInsight } from "./bunk-insight";
import { riskBand } from "./risk";
import {
  countRemainingClasses,
  projectSemesterEnd,
  teachingSuppressedOn,
  type CalendarBlockLike,
  type CountableSession,
} from "./projection";
import type { RiskBand, SubjectStanding, TargetSettings } from "./types";

export type BunkScenarioResult = {
  attended: number;
  total: number;
  extraSkips: number;
  extraAttends: number;
  percentage: number | null;
  standing: SubjectStanding;
  risk: RiskBand;
  canStillSkip: number;
  mustAttend: number;
  remainingAfterScenario: number;
  semesterIfAttendAllRemaining: number | null;
  semesterIfSkipAllRemaining: number | null;
  semesterRiskIfAttendAll: RiskBand;
  semesterRiskIfSkipAll: RiskBand;
  dropsBelowCollegeMin: boolean;
  dropsBelowBuffer: boolean;
};

export type SkipAttendStep = {
  step: number;
  skipPct: number;
  attendPct: number;
  skipRisk: RiskBand;
  attendRisk: RiskBand;
};

export type SubjectBunkOutlook = {
  subjectId: string;
  name: string;
  shortCode: string;
  color: string;
  standing: SubjectStanding;
  bunkInsight: string;
};

export type UpcomingSessionRow = {
  sessionId: string;
  subjectId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  sessionType: string;
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

function sessionIsCountable(session: CountableSession): boolean {
  if (session.countsTowardAttendance === false) return false;
  if (session.status === "cancelled" || session.status === "holiday") {
    return false;
  }
  return true;
}

/**
 * Apply hypothetical skips / recovery attends on top of current A/T,
 * with term-bounded standing and semester-end branches.
 */
export function simulateBunkScenario(args: {
  attended: number;
  total: number;
  remainingClasses: number;
  settings: TargetSettings;
  extraSkips?: number;
  extraAttends?: number;
}): BunkScenarioResult {
  const extraSkips = Math.max(0, Math.floor(args.extraSkips ?? 0));
  const extraAttends = Math.max(0, Math.floor(args.extraAttends ?? 0));
  const attended = args.attended + extraAttends;
  const total = args.total + extraSkips + extraAttends;
  const remaining = Math.max(
    0,
    Math.floor(args.remainingClasses) - extraSkips - extraAttends,
  );

  const standing = calculateSubjectStanding(
    attended,
    total,
    args.settings,
    remaining,
  );
  const percentage = standing.percentage;
  const { collegeTargetPct, bufferPct } = args.settings;
  const effective = effectiveTargetPct(collegeTargetPct, bufferPct);

  const projection = projectSemesterEnd({
    attended,
    total,
    remainingClasses: remaining,
    settings: args.settings,
  });

  return {
    attended,
    total,
    extraSkips,
    extraAttends,
    percentage,
    standing,
    risk: standing.risk,
    canStillSkip: classesYouCanSkip(attended, total, effective),
    mustAttend: standing.classesToRecover,
    remainingAfterScenario: remaining,
    semesterIfAttendAllRemaining: projection.ifAttendAllPct,
    semesterIfSkipAllRemaining: projection.ifSkipAllPct,
    semesterRiskIfAttendAll: projection.riskIfAttendAll,
    semesterRiskIfSkipAll: projection.riskIfSkipAll,
    dropsBelowCollegeMin:
      percentage != null && percentage + 1e-9 < collegeTargetPct,
    dropsBelowBuffer:
      percentage != null && percentage + 1e-9 < effective,
  };
}

/** Next K classes — cumulative skip-all vs attend-all paths from a base A/T. */
export function buildSkipAttendLadder(args: {
  attended: number;
  total: number;
  settings: TargetSettings;
  steps?: number;
}): SkipAttendStep[] {
  const steps = Math.max(1, Math.min(20, Math.floor(args.steps ?? 8)));
  const { collegeTargetPct, bufferPct } = args.settings;
  const rows: SkipAttendStep[] = [];

  for (let k = 1; k <= steps; k += 1) {
    const skipPct =
      calculatePercentage(args.attended, args.total + k) ?? 0;
    const attendPct =
      calculatePercentage(args.attended + k, args.total + k) ?? 0;
    rows.push({
      step: k,
      skipPct,
      attendPct,
      skipRisk: riskBand(skipPct, collegeTargetPct, bufferPct),
      attendRisk: riskBand(attendPct, collegeTargetPct, bufferPct),
    });
  }
  return rows;
}

/** How many consecutive skips until risk hits Warning or Critical. */
export function skipsUntilRiskBand(args: {
  attended: number;
  total: number;
  settings: TargetSettings;
  targetBand: "Critical" | "Warning";
}): number | null {
  const { collegeTargetPct, bufferPct } = args.settings;
  const threshold =
    args.targetBand === "Critical"
      ? collegeTargetPct
      : collegeTargetPct + bufferPct;

  for (let k = 1; k <= 60; k += 1) {
    const pct = calculatePercentage(args.attended, args.total + k);
    if (pct == null) continue;
    if (pct + 1e-9 < threshold) return k;
  }
  return null;
}

/** Rank subjects by safe bunks this term (desc), then risk severity. */
export function buildSubjectBunkOutlook(args: {
  subjects: Array<{
    id: string;
    name: string;
    shortCode: string;
    color: string;
    attended: number;
    total: number;
    collegeTargetPct: number;
  }>;
  sessions: CountableSession[];
  asOfYmd: string;
  semesterEnd?: string;
  calendarBlocks?: CalendarBlockLike[];
  bufferPct: number;
}): SubjectBunkOutlook[] {
  const riskOrder: Record<RiskBand, number> = {
    Safe: 0,
    Warning: 1,
    Critical: 2,
  };

  const rows = args.subjects.map((subject) => {
    const remaining = countRemainingClasses({
      sessions: args.sessions,
      asOfYmd: args.asOfYmd,
      semesterEnd: args.semesterEnd,
      subjectId: subject.id,
      calendarBlocks: args.calendarBlocks,
    });
    const standing = calculateSubjectStanding(
      subject.attended,
      subject.total,
      { collegeTargetPct: subject.collegeTargetPct, bufferPct: args.bufferPct },
      remaining,
    );
    return {
      subjectId: subject.id,
      name: subject.name,
      shortCode: subject.shortCode,
      color: subject.color,
      standing,
      bunkInsight: formatBunkInsight(standing),
    };
  });

  rows.sort((a, b) => {
    const skipDiff = b.standing.canSkipThisTerm - a.standing.canSkipThisTerm;
    if (skipDiff !== 0) return skipDiff;
    const riskDiff =
      riskOrder[a.standing.risk] - riskOrder[b.standing.risk];
    if (riskDiff !== 0) return riskDiff;
    const ap = a.standing.percentage ?? 999;
    const bp = b.standing.percentage ?? 999;
    return ap - bp;
  });

  return rows;
}

export type PickableSession = CountableSession & {
  id: string;
  endsAt: string;
  location?: string;
};

/** Upcoming countable sessions for pick-to-skip mode. */
export function listUpcomingCountableSessions(args: {
  sessions: PickableSession[];
  subjectId: string;
  asOfYmd: string;
  semesterEnd?: string;
  calendarBlocks?: CalendarBlockLike[];
  limit?: number;
}): UpcomingSessionRow[] {
  const limit = Math.max(1, Math.min(40, Math.floor(args.limit ?? 24)));
  const blocks = args.calendarBlocks ?? [];
  const rows: UpcomingSessionRow[] = [];

  for (const session of args.sessions) {
    if (session.subjectId !== args.subjectId) continue;
    if (!sessionIsCountable(session)) continue;
    const date = ymdFromIso(session.startsAt);
    if (compareYmd(date, args.asOfYmd) < 0) continue;
    if (args.semesterEnd && compareYmd(date, args.semesterEnd) > 0) continue;
    if (teachingSuppressedOn(date, blocks)) continue;
    rows.push({
      sessionId: session.id,
      subjectId: session.subjectId,
      date,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      location: session.location,
      sessionType: session.sessionType ?? "lecture",
    });
  }

  rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return rows.slice(0, limit);
}
