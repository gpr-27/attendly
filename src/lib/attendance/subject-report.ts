/**
 * Per-subject schedule + marks report for Coach / Subjects detail sheet.
 * Uses materialized ClassSession rows in the semester range — no invented classes.
 */

import {
  getSettings,
  getSubject,
  listAttendance,
  listCalendarBlocks,
  listSessions,
  type AttendanceRecord,
  type AttendanceStatus,
  type ClassSession,
  type Subject,
} from "@/lib/db";
import {
  formatDayLabel,
  mondayOfWeekYmd,
  sessionLocalYmd,
  todayYmd,
} from "@/lib/dates";
import { formatBunkInsight } from "./bunk-insight";
import { calculateSubjectStanding } from "./bunk-math";
import { countRemainingClasses } from "./projection";
import { countAttendanceFromMarks } from "./session-counting";
import { resolveCollegeTargetPct } from "./targets";
import type { OdCountsAs, SubjectStanding } from "./types";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Display mark/session status for the subject report list. */
export type SubjectReportMarkStatus =
  | "present"
  | "absent"
  | "cancelled"
  | "holiday"
  | "on_duty"
  | "late"
  | "excused"
  | "not_marked";

export type SubjectReportSessionRow = {
  sessionId: string;
  ymd: string;
  weekday: string;
  dayLabel: string;
  startLabel: string;
  endLabel: string;
  room: string | null;
  status: SubjectReportMarkStatus;
  isPast: boolean;
  isToday: boolean;
};

export type SubjectReportWeekGroup = {
  weekStartYmd: string;
  weekLabel: string;
  sessions: SubjectReportSessionRow[];
};

export type SubjectReportSummary = {
  present: number;
  absent: number;
  onDuty: number;
  cancelled: number;
  holiday: number;
  notMarked: number;
  remaining: number;
  totalSessions: number;
};

export type SubjectReport = {
  subjectId: string;
  name: string;
  shortCode: string;
  standing: SubjectStanding;
  bunkLine: string;
  summary: SubjectReportSummary;
  weeks: SubjectReportWeekGroup[];
};

export function subjectReportStatusLabel(
  status: SubjectReportMarkStatus,
): string {
  switch (status) {
    case "present":
      return "Present";
    case "absent":
      return "Absent";
    case "cancelled":
      return "Cancelled";
    case "holiday":
      return "Holiday";
    case "on_duty":
      return "OD";
    case "late":
      return "Late";
    case "excused":
      return "Excused";
    case "not_marked":
      return "Not marked";
  }
}

/** Session lifecycle wins over marks for cancelled/holiday. */
export function resolveSubjectReportStatus(
  sessionStatus: string,
  markStatus: AttendanceStatus | undefined,
): SubjectReportMarkStatus {
  if (sessionStatus === "cancelled") return "cancelled";
  if (sessionStatus === "holiday") return "holiday";
  if (!markStatus) return "not_marked";
  if (markStatus === "on_duty") return "on_duty";
  if (markStatus === "present") return "present";
  if (markStatus === "absent") return "absent";
  if (markStatus === "late") return "late";
  if (markStatus === "excused") return "excused";
  return "not_marked";
}

function mapOd(settingsOd: string | undefined): OdCountsAs {
  if (settingsOd === "present" || settingsOd === "absent") return settingsOd;
  return "exclude";
}

function timeLabelFromIso(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function weekLabel(weekStartYmd: string): string {
  const end = (() => {
    const [y, m, d] = weekStartYmd.split("-").map(Number);
    const dt = new Date(y!, m! - 1, d!);
    dt.setDate(dt.getDate() + 6);
    return formatDayLabel(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`,
    );
  })();
  return `${formatDayLabel(weekStartYmd)} – ${end}`;
}

function emptySummary(): SubjectReportSummary {
  return {
    present: 0,
    absent: 0,
    onDuty: 0,
    cancelled: 0,
    holiday: 0,
    notMarked: 0,
    remaining: 0,
    totalSessions: 0,
  };
}

function bumpSummary(
  summary: SubjectReportSummary,
  status: SubjectReportMarkStatus,
) {
  switch (status) {
    case "present":
    case "late":
      summary.present += 1;
      break;
    case "absent":
      summary.absent += 1;
      break;
    case "on_duty":
      summary.onDuty += 1;
      break;
    case "cancelled":
      summary.cancelled += 1;
      break;
    case "holiday":
      summary.holiday += 1;
      break;
    case "not_marked":
    case "excused":
      summary.notMarked += 1;
      break;
  }
}

/**
 * Pure builder — pass Dexie-loaded rows. Filters to one subject in semester range.
 */
export function buildSubjectReport(input: {
  subject: Subject;
  sessions: ClassSession[];
  marks: AttendanceRecord[];
  standing: SubjectStanding;
  semesterStart?: string;
  semesterEnd?: string;
  asOfYmd?: string;
}): SubjectReport {
  const asOf = input.asOfYmd ?? todayYmd();
  const start = input.semesterStart?.trim() || "";
  const end = input.semesterEnd?.trim() || "";
  const sid = String(input.subject.id);
  const markBySession = new Map(
    input.marks.map((m) => [String(m.sessionId), m]),
  );

  const rows: SubjectReportSessionRow[] = [];

  for (const session of input.sessions) {
    if (String(session.subjectId) !== sid) continue;
    const ymd = sessionLocalYmd(session);
    if (start && ymd < start) continue;
    if (end && ymd > end) continue;

    const mark = markBySession.get(String(session.id));
    const status = resolveSubjectReportStatus(session.status, mark?.status);
    const [y, m, d] = ymd.split("-").map(Number);
    const weekday = WEEKDAYS[new Date(y!, m! - 1, d!).getDay()] ?? "Day";

    rows.push({
      sessionId: String(session.id),
      ymd,
      weekday,
      dayLabel: formatDayLabel(ymd),
      startLabel: timeLabelFromIso(session.startsAt),
      endLabel: timeLabelFromIso(session.endsAt),
      room: session.location?.trim() || null,
      status,
      isPast: ymd < asOf,
      isToday: ymd === asOf,
    });
  }

  rows.sort((a, b) => {
    const byDate = a.ymd.localeCompare(b.ymd);
    if (byDate !== 0) return byDate;
    return a.startLabel.localeCompare(b.startLabel);
  });

  const summary = emptySummary();
  summary.totalSessions = rows.length;
  for (const row of rows) bumpSummary(summary, row.status);
  summary.remaining = input.standing.remainingClasses;

  const weekMap = new Map<string, SubjectReportSessionRow[]>();
  for (const row of rows) {
    const weekStart = mondayOfWeekYmd(row.ymd);
    const list = weekMap.get(weekStart) ?? [];
    list.push(row);
    weekMap.set(weekStart, list);
  }

  const weeks: SubjectReportWeekGroup[] = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStartYmd, sessions]) => ({
      weekStartYmd,
      weekLabel: weekLabel(weekStartYmd),
      sessions,
    }));

  return {
    subjectId: sid,
    name: input.subject.name,
    shortCode: input.subject.shortCode,
    standing: input.standing,
    bunkLine: formatBunkInsight(input.standing),
    summary,
    weeks,
  };
}

/** Load one subject report from Dexie (after materialize). */
export async function loadSubjectReport(
  subjectId: string,
): Promise<SubjectReport | null> {
  const subject = await getSubject(subjectId);
  if (!subject || subject.archived) return null;

  const [settings, sessions, marks, blocks] = await Promise.all([
    getSettings(),
    listSessions(),
    listAttendance(),
    listCalendarBlocks(),
  ]);

  const sessionById = new Map<string, ClassSession>();
  for (const s of sessions) sessionById.set(String(s.id), s);

  const od = mapOd(settings.odCountsAs as string | undefined);
  const markRows: Array<{
    markStatus: AttendanceStatus;
    sessionStatus?: string;
    countsTowardAttendance?: boolean;
  }> = [];

  for (const mark of marks) {
    const session = sessionById.get(String(mark.sessionId));
    if (!session || String(session.subjectId) !== String(subjectId)) continue;
    markRows.push({
      markStatus: mark.status,
      sessionStatus: session.status,
      countsTowardAttendance: session.countsTowardAttendance,
    });
  }

  const { attended, total } = countAttendanceFromMarks(markRows, od);
  const asOf = todayYmd();
  const semesterEnd = settings.semesterEnd?.trim() || undefined;
  const remaining = countRemainingClasses({
    sessions: sessions.map((s) => ({
      subjectId: String(s.subjectId),
      startsAt: s.startsAt,
      status: s.status,
      countsTowardAttendance: s.countsTowardAttendance,
      sessionType: s.sessionType,
    })),
    asOfYmd: asOf,
    semesterEnd,
    subjectId: String(subjectId),
    calendarBlocks: blocks,
  });

  const standing = calculateSubjectStanding(
    attended,
    total,
    {
      collegeTargetPct: resolveCollegeTargetPct({
        settingsTargetPct: settings.targetPct,
        subjectTargetPct: subject.targetPct,
      }),
      bufferPct: settings.bufferPct,
    },
    remaining,
  );

  return buildSubjectReport({
    subject,
    sessions,
    marks,
    standing,
    semesterStart: settings.semesterStart,
    semesterEnd: settings.semesterEnd,
    asOfYmd: asOf,
  });
}
