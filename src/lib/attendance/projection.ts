import {
  calculatePercentage,
  calculateSubjectStanding,
  canSkipThisTerm,
  mustAttendThisTerm,
} from "./bunk-math";
import { riskBand } from "./risk";
import type { RiskBand, SubjectStanding, TargetSettings } from "./types";

export type CountableSession = {
  subjectId: string;
  startsAt: string;
  status: string;
  countsTowardAttendance?: boolean;
  sessionType?: string;
};

export type CalendarBlockLike = {
  startsOn: string;
  endsOn: string;
  suppressesTeaching: boolean;
};

function ymdFromIso(iso: string): string {
  // Prefer local calendar day from ISO; fall back to date prefix.
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

export function isDateInBlock(
  date: string,
  block: CalendarBlockLike,
): boolean {
  return (
    compareYmd(date, block.startsOn) >= 0 &&
    compareYmd(date, block.endsOn) <= 0
  );
}

/** True when any suppressing block covers this date (exam week / holiday). */
export function teachingSuppressedOn(
  date: string,
  blocks: CalendarBlockLike[],
): boolean {
  return blocks.some((b) => b.suppressesTeaching && isDateInBlock(date, b));
}

function sessionIsCountable(session: CountableSession): boolean {
  if (session.countsTowardAttendance === false) return false;
  if (session.status === "cancelled" || session.status === "holiday") {
    return false;
  }
  return true;
}

/**
 * Future countable sessions from `asOfYmd` (exclusive of past days)
 * through `semesterEnd`, skipping exam/holiday blackouts.
 */
export function countRemainingClasses(args: {
  sessions: CountableSession[];
  asOfYmd: string;
  semesterEnd?: string;
  subjectId?: string;
  calendarBlocks?: CalendarBlockLike[];
}): number {
  const blocks = args.calendarBlocks ?? [];
  let n = 0;
  for (const session of args.sessions) {
    if (args.subjectId && session.subjectId !== args.subjectId) continue;
    if (!sessionIsCountable(session)) continue;
    const date = ymdFromIso(session.startsAt);
    if (compareYmd(date, args.asOfYmd) < 0) continue;
    if (args.semesterEnd && compareYmd(date, args.semesterEnd) > 0) continue;
    if (teachingSuppressedOn(date, blocks)) continue;
    n += 1;
  }
  return n;
}

export type SemesterProjection = {
  attended: number;
  total: number;
  remaining: number;
  standing: SubjectStanding;
  /** % if you attend every remaining class. */
  ifAttendAllPct: number | null;
  /** % if you miss every remaining class. */
  ifSkipAllPct: number | null;
  safeToSkip: number;
  mustAttend: number | null;
  riskIfAttendAll: RiskBand;
  riskIfSkipAll: RiskBand;
};

/**
 * Semester-end projection from current A/T and remaining teaching days.
 * Blackouts are applied by `countRemainingClasses` (or pass a pre-filtered remaining).
 */
export function projectSemesterEnd(args: {
  attended: number;
  total: number;
  remainingClasses: number;
  settings: TargetSettings;
}): SemesterProjection {
  const { attended, total, settings } = args;
  const remaining = Math.max(0, Math.floor(args.remainingClasses));
  const standing = calculateSubjectStanding(
    attended,
    total,
    settings,
    remaining,
  );

  const ifAttendAllPct =
    remaining === 0 && total === 0
      ? null
      : calculatePercentage(attended + remaining, total + remaining);
  const ifSkipAllPct =
    remaining === 0 && total === 0
      ? null
      : calculatePercentage(attended, total + remaining);

  const college = settings.collegeTargetPct;
  const buffer = settings.bufferPct;

  return {
    attended,
    total,
    remaining,
    standing,
    ifAttendAllPct,
    ifSkipAllPct,
    safeToSkip: canSkipThisTerm(
      attended,
      total,
      remaining,
      standing.effectiveTargetPct,
    ),
    mustAttend: mustAttendThisTerm(
      attended,
      total,
      remaining,
      standing.effectiveTargetPct,
    ),
    riskIfAttendAll: riskBand(ifAttendAllPct, college, buffer),
    riskIfSkipAll: riskBand(ifSkipAllPct, college, buffer),
  };
}

export type SubjectProjectionRow = {
  subjectId: string;
  shortCode: string;
  name: string;
  color: string;
  projection: SemesterProjection;
};

/**
 * Build per-subject projections from counts + remaining session list.
 */
export function projectAllSubjects(args: {
  subjects: Array<{
    id: string;
    shortCode: string;
    name: string;
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
}): SubjectProjectionRow[] {
  return args.subjects.map((subject) => {
    const remaining = countRemainingClasses({
      sessions: args.sessions,
      asOfYmd: args.asOfYmd,
      semesterEnd: args.semesterEnd,
      subjectId: subject.id,
      calendarBlocks: args.calendarBlocks,
    });
    return {
      subjectId: subject.id,
      shortCode: subject.shortCode,
      name: subject.name,
      color: subject.color,
      projection: projectSemesterEnd({
        attended: subject.attended,
        total: subject.total,
        remainingClasses: remaining,
        settings: {
          collegeTargetPct: subject.collegeTargetPct,
          bufferPct: args.bufferPct,
        },
      }),
    };
  });
}
