/**
 * Full attendance report payload from Dexie only — no invented numbers.
 */

import {
  getSettings,
  listAttendance,
  listCalendarBlocks,
  listSeries,
  listSessions,
  listSubjects,
  type AttendanceRecord,
  type AttendanceStatus,
  type ClassSession,
  type Subject,
  type TimetableSeries,
} from "@/lib/db";
import {
  calculatePercentage,
  calculateSubjectStanding,
  countAttendanceFromMarks,
  countRemainingClasses,
  resolveCollegeTargetPct,
  type OdCountsAs,
  type RiskBand,
} from "@/lib/attendance";
import { computeStreaks, type StreakStats } from "@/lib/analytics/patterns";
import { formatDayLabel, parseYmd, todayYmd, ymdFromDate } from "@/lib/dates";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type ReportStatusCounts = {
  present: number;
  absent: number;
  onDuty: number;
  late: number;
  excused: number;
};

export type ReportSubjectDetail = {
  id: string;
  name: string;
  shortCode: string;
  attended: number;
  total: number;
  pct: number | null;
  counts: ReportStatusCounts;
  collegeTargetPct: number;
  effectiveTargetPct: number;
  bunksLeft: number;
  recovery: number;
  risk: RiskBand;
};

export type WeeklyPatternSlot = {
  startTime: string;
  endTime: string;
  shortCode: string;
  name: string;
  sessionType: string;
  location?: string;
  weekParity: string;
};

export type WeeklyPatternDay = {
  dayOfWeek: number;
  dayName: string;
  slots: WeeklyPatternSlot[];
};

export type HistoryDayItem = {
  time: string;
  name: string;
  shortCode: string;
  status: AttendanceStatus | "unmarked";
};

export type HistoryDay = {
  date: string;
  dayLabel: string;
  items: HistoryDayItem[];
};

export type AttendanceReport = {
  generatedAt: string;
  semesterName: string;
  semesterStart: string;
  semesterEnd: string;
  targetPct: number;
  bufferPct: number;
  overall: {
    attended: number;
    total: number;
    pct: number | null;
    counts: ReportStatusCounts;
    risk: RiskBand;
    bunksLeft: number;
    recovery: number;
  };
  subjects: ReportSubjectDetail[];
  weeklyPattern: WeeklyPatternDay[];
  history: HistoryDay[];
  streaks: StreakStats;
};

function mapOd(settingsOd: string | undefined): OdCountsAs {
  if (settingsOd === "present" || settingsOd === "absent") return settingsOd;
  return "exclude";
}

function normalizeSessionStatus(status: string): string {
  if (status === "cancelled" || status === "holiday") return status;
  return "held";
}

function emptyCounts(): ReportStatusCounts {
  return { present: 0, absent: 0, onDuty: 0, late: 0, excused: 0 };
}

function bumpCount(counts: ReportStatusCounts, status: AttendanceStatus) {
  switch (status) {
    case "present":
      counts.present += 1;
      break;
    case "absent":
      counts.absent += 1;
      break;
    case "on_duty":
      counts.onDuty += 1;
      break;
    case "late":
      counts.late += 1;
      break;
    case "excused":
      counts.excused += 1;
      break;
  }
}

function localYmdFromIso(iso: string): string {
  return ymdFromDate(new Date(iso));
}

function timeLabelFromIso(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildWeeklyPattern(
  series: TimetableSeries[],
  subjects: Subject[],
): WeeklyPatternDay[] {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const days: WeeklyPatternDay[] = [];

  for (let dow = 0; dow <= 6; dow++) {
    const slots = series
      .filter((s) => s.dayOfWeek === dow)
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((s) => {
        const sub = byId.get(s.subjectId);
        return {
          startTime: s.startTime,
          endTime: s.endTime,
          shortCode: sub?.shortCode ?? "?",
          name: sub?.name ?? "Unknown",
          sessionType: s.sessionType,
          location: s.location,
          weekParity: s.weekParity ?? "all",
        };
      });
    if (slots.length === 0) continue;
    days.push({
      dayOfWeek: dow,
      dayName: DAY_NAMES[dow] ?? `Day ${dow}`,
      slots,
    });
  }
  return days;
}

function buildHistory(
  sessions: ClassSession[],
  marks: AttendanceRecord[],
  subjects: Subject[],
  semesterStart: string,
  semesterEnd: string,
): HistoryDay[] {
  const markBySession = new Map(marks.map((m) => [m.sessionId, m]));
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const start = parseYmd(semesterStart);
  const end = parseYmd(semesterEnd);

  const byDate = new Map<string, HistoryDayItem[]>();

  for (const session of sessions) {
    const date = localYmdFromIso(session.startsAt);
    if (start && date < start) continue;
    if (end && date > end) continue;

    const mark = markBySession.get(session.id);
    // Include days that have a mark, or past/today sessions in range.
    if (!mark && date > ymdFromDate(new Date())) continue;

    const sub = byId.get(session.subjectId);
    const list = byDate.get(date) ?? [];
    list.push({
      time: timeLabelFromIso(session.startsAt),
      name: sub?.name ?? "Unknown",
      shortCode: sub?.shortCode ?? "?",
      status: (mark?.status as AttendanceStatus | undefined) ?? "unmarked",
    });
    byDate.set(date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      dayLabel: formatDayLabel(date),
      items: items.sort((a, b) => a.time.localeCompare(b.time)),
    }));
}

/** Load everything from Dexie and build a printable report model. */
export async function buildAttendanceReport(): Promise<AttendanceReport> {
  const [settings, subjectsRaw, sessions, marks, series, blocks] =
    await Promise.all([
      getSettings(),
      listSubjects(),
      listSessions(),
      listAttendance(),
      listSeries(),
      listCalendarBlocks(),
    ]);

  const subjects = (subjectsRaw as Subject[]).filter((s) => !s.archived);
  const od = mapOd(settings.odCountsAs as string | undefined);
  const sessionById = new Map<string, ClassSession>();
  for (const s of sessions as ClassSession[]) sessionById.set(s.id, s);

  const countableSessions = (sessions as ClassSession[]).map((s) => ({
    subjectId: String(s.subjectId),
    startsAt: s.startsAt,
    status: s.status,
    countsTowardAttendance: s.countsTowardAttendance,
    sessionType: s.sessionType,
  }));
  const asOf = todayYmd();
  const semesterEnd = settings.semesterEnd?.trim() || undefined;

  const overallCounts = emptyCounts();
  const marksBySubject = new Map<
    string,
    Array<{
      markStatus: AttendanceStatus;
      sessionStatus: string;
      countsTowardAttendance?: boolean;
    }>
  >();

  for (const mark of marks as AttendanceRecord[]) {
    const session = sessionById.get(mark.sessionId);
    if (!session) continue;
    bumpCount(overallCounts, mark.status);
    const sid = session.subjectId;
    const list = marksBySubject.get(sid) ?? [];
    list.push({
      markStatus: mark.status,
      sessionStatus: normalizeSessionStatus(session.status),
      countsTowardAttendance: session.countsTowardAttendance,
    });
    marksBySubject.set(sid, list);
  }

  const allRows = [...marksBySubject.values()].flat();
  const { attended: overallAttended, total: overallTotal } =
    countAttendanceFromMarks(allRows, od);
  const overallRemaining = countRemainingClasses({
    sessions: countableSessions,
    asOfYmd: asOf,
    semesterEnd,
    calendarBlocks: blocks,
  });
  const overallStanding = calculateSubjectStanding(
    overallAttended,
    overallTotal,
    {
      collegeTargetPct: settings.targetPct,
      bufferPct: settings.bufferPct,
    },
    overallRemaining,
  );

  const subjectDetails: ReportSubjectDetail[] = subjects
    .map((subject) => {
      const rows = marksBySubject.get(subject.id) ?? [];
      const { attended, total } = countAttendanceFromMarks(rows, od);
      const collegeTargetPct = resolveCollegeTargetPct({
        settingsTargetPct: settings.targetPct,
        subjectTargetPct: subject.targetPct,
      });
      const remaining = countRemainingClasses({
        sessions: countableSessions,
        asOfYmd: asOf,
        semesterEnd,
        subjectId: subject.id,
        calendarBlocks: blocks,
      });
      const standing = calculateSubjectStanding(
        attended,
        total,
        { collegeTargetPct, bufferPct: settings.bufferPct },
        remaining,
      );
      const counts = emptyCounts();
      for (const row of rows) bumpCount(counts, row.markStatus);

      return {
        id: subject.id,
        name: subject.name,
        shortCode: subject.shortCode,
        attended,
        total,
        pct: calculatePercentage(attended, total),
        counts,
        collegeTargetPct,
        effectiveTargetPct: standing.effectiveTargetPct,
        bunksLeft:
          remaining > 0
            ? standing.canSkipThisTerm
            : standing.classesYouCanSkip,
        recovery:
          remaining > 0
            ? (standing.mustAttendThisTerm ?? standing.classesToRecover)
            : standing.classesToRecover,
        risk: standing.risk,
      };
    })
    .sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999));

  const streaks = computeStreaks(
    sessions as ClassSession[],
    marks as AttendanceRecord[],
  );

  return {
    generatedAt: new Date().toISOString(),
    semesterName: settings.semesterName,
    semesterStart: settings.semesterStart,
    semesterEnd: settings.semesterEnd,
    targetPct: settings.targetPct,
    bufferPct: settings.bufferPct,
    overall: {
      attended: overallAttended,
      total: overallTotal,
      pct: overallStanding.percentage,
      counts: overallCounts,
      risk: overallStanding.risk,
      bunksLeft:
        overallRemaining > 0
          ? overallStanding.canSkipThisTerm
          : overallStanding.classesYouCanSkip,
      recovery:
        overallRemaining > 0
          ? (overallStanding.mustAttendThisTerm ??
            overallStanding.classesToRecover)
          : overallStanding.classesToRecover,
    },
    subjects: subjectDetails,
    weeklyPattern: buildWeeklyPattern(series as TimetableSeries[], subjects),
    history: buildHistory(
      sessions as ClassSession[],
      marks as AttendanceRecord[],
      subjects,
      settings.semesterStart,
      settings.semesterEnd,
    ),
    streaks,
  };
}
