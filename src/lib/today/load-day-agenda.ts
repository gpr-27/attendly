import {
  calculateSubjectStanding,
  countAttendanceFromMarks,
  countRemainingClasses,
  formatBunkInsight,
  impactLine,
  type AttendanceMarkStatus,
  type OdCountsAs,
} from "@/lib/attendance";
import { dayBoundsIso, sessionLocalYmd, todayYmd } from "@/lib/dates";
import type { AgendaClass, MarkStatus } from "@/lib/today-types";
import { mapOdPolicy, toRiskLevel } from "@/lib/today-types";

function formatTime(iso: string, use24h: boolean) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: !use24h,
  });
}

function hmFromIso(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function normalizeSessionStatus(
  status: string,
): "held" | "cancelled" | "holiday" {
  if (status === "cancelled" || status === "holiday") return status;
  return "held";
}

export type DayAgendaLoadResult = {
  items: AgendaClass[];
  subjectCount: number;
  seriesCount: number;
  overallPct: number | null;
  overallRisk: AgendaClass["risk"];
  /** Term-bounded bunk/recover line for the hero. */
  bunkInsight: string | null;
  targetPct: number;
  bufferPct: number;
  dayLabel: string;
  onboarded: boolean;
  /** True when a calendarBlocks blackout covers this date. */
  holidayBlocked: boolean;
};

/**
 * Load Dexie sessions + marks for one local calendar day.
 * No fake rows — empty when nothing materialized.
 */
export async function loadDayAgenda(
  ymd: string,
): Promise<DayAgendaLoadResult> {
  const {
    getSettings,
    listSessionsInRange,
    listSubjects,
    listAttendance,
    listSeries,
    getSession,
  } = await import("@/lib/db");
  const { ensureSessionsMaterialized } = await import("@/lib/timetable");
  const { formatDayLabel } = await import("@/lib/dates");

  const settings = await getSettings();
  const bounds = dayBoundsIso(ymd);

  try {
    // Full semester window so Rem / bunk forecast has future sessions.
    await ensureSessionsMaterialized();
  } catch {
    /* non-fatal */
  }

  const { isTeachingSuppressedOn } = await import("@/lib/timetable");
  const { listCalendarBlocks, listSessions } = await import("@/lib/db");
  const holidayBlocked = await isTeachingSuppressedOn(ymd).catch(() => false);

  const [sessions, subjects, allMarks, series, allSessions, blocks] =
    await Promise.all([
      listSessionsInRange(bounds.fromIso, bounds.toIso),
      listSubjects(),
      listAttendance(),
      listSeries(),
      listSessions(),
      listCalendarBlocks(),
    ]);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const markBySession = new Map(allMarks.map((m) => [m.sessionId, m]));

  const sessionCache = new Map<
    string,
    Awaited<ReturnType<typeof getSession>>
  >();
  async function sessionOf(id: string) {
    if (!sessionCache.has(id)) sessionCache.set(id, await getSession(id));
    return sessionCache.get(id);
  }

  const od: OdCountsAs = mapOdPolicy(settings.odCountsAs);
  const asOf = todayYmd();
  const semesterEnd = settings.semesterEnd?.trim() || undefined;
  const countableSessions = allSessions.map((s) => ({
    subjectId: String(s.subjectId),
    startsAt: s.startsAt,
    status: s.status,
    countsTowardAttendance: s.countsTowardAttendance,
    sessionType: s.sessionType,
  }));

  type Standing = {
    pct: number | null;
    risk: AgendaClass["risk"];
    impact: string | null;
    bunkInsight: string | null;
  };
  const standingBySubject = new Map<string, Standing>();

  const subjectIds = new Set([
    ...subjects.map((s) => s.id),
    ...sessions.map((s) => s.subjectId),
  ]);

  for (const subjectId of subjectIds) {
    const rows: Array<{
      markStatus: AttendanceMarkStatus;
      sessionStatus: string;
      countsTowardAttendance?: boolean;
    }> = [];

    for (const mark of allMarks) {
      const session = await sessionOf(mark.sessionId);
      if (session?.subjectId !== subjectId) continue;
      rows.push({
        markStatus: mark.status,
        sessionStatus: normalizeSessionStatus(session.status),
        countsTowardAttendance: session.countsTowardAttendance,
      });
    }

    const counts = countAttendanceFromMarks(rows, od);
    const subject = subjectById.get(subjectId);
    const remaining = countRemainingClasses({
      sessions: countableSessions,
      asOfYmd: asOf,
      semesterEnd,
      subjectId: String(subjectId),
      calendarBlocks: blocks,
    });
    const fullStanding = calculateSubjectStanding(
      counts.attended,
      counts.total,
      {
        collegeTargetPct: settings.targetPct,
        bufferPct: settings.bufferPct,
      },
      remaining,
    );
    const impact =
      counts.total > 0 && subject
        ? impactLine(
            subject.shortCode || subject.name,
            counts.attended,
            counts.total,
          ).line
        : null;

    standingBySubject.set(subjectId, {
      pct: fullStanding.percentage,
      risk: toRiskLevel(fullStanding.risk),
      impact,
      bunkInsight:
        counts.total > 0 || remaining > 0
          ? formatBunkInsight(fullStanding)
          : null,
    });
  }

  const overallRows = [];
  for (const mark of allMarks) {
    const session = await sessionOf(mark.sessionId);
    if (!session) continue;
    overallRows.push({
      markStatus: mark.status as AttendanceMarkStatus,
      sessionStatus: normalizeSessionStatus(session.status),
      countsTowardAttendance: session.countsTowardAttendance,
    });
  }
  const overall = countAttendanceFromMarks(overallRows, od);
  const overallRemaining = countRemainingClasses({
    sessions: countableSessions,
    asOfYmd: asOf,
    semesterEnd,
    calendarBlocks: blocks,
  });
  const overallStanding = calculateSubjectStanding(
    overall.attended,
    overall.total,
    {
      collegeTargetPct: settings.targetPct,
      bufferPct: settings.bufferPct,
    },
    overallRemaining,
  );
  const overallPercentage = overallStanding.percentage;
  const bunkInsight =
    overall.total > 0 || overallRemaining > 0
      ? formatBunkInsight(overallStanding)
      : null;

  const items: AgendaClass[] = sessions
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((session) => {
      const subject = subjectById.get(session.subjectId);
      const mark = markBySession.get(session.id);
      const standing = standingBySubject.get(session.subjectId);

      let status: MarkStatus = "unmarked";
      if (session.status === "cancelled") status = "cancelled";
      else if (session.status === "holiday") status = "holiday";
      else if (mark?.status === "present" || mark?.status === "late")
        status = "present";
      else if (mark?.status === "absent") status = "absent";
      else if (mark?.status === "on_duty" || mark?.status === "excused")
        status = "on_duty";

      return {
        id: session.id,
        subjectName: subject?.name ?? "Unknown subject",
        shortCode: subject?.shortCode ?? "—",
        color: subject?.color ?? "#6b7a8d",
        startLabel: formatTime(session.startsAt, settings.use24h),
        endLabel: formatTime(session.endsAt, settings.use24h),
        endsAtMs: new Date(session.endsAt).getTime(),
        ymd: sessionLocalDate(session),
        startHm: hmFromIso(session.startsAt),
        endHm: hmFromIso(session.endsAt),
        location: session.location,
        status,
        seriesId: session.seriesId,
        pct: standing?.pct ?? null,
        risk: standing?.risk ?? null,
        impactLine: standing?.bunkInsight ?? standing?.impact ?? null,
        sessionType: session.sessionType,
        relevance: session.relevance,
      };
    });

  return {
    items,
    subjectCount: subjects.filter((s) => !s.archived).length,
    seriesCount: series.length,
    overallPct: overallPercentage,
    overallRisk:
      overallPercentage === null
        ? null
        : toRiskLevel(overallStanding.risk),
    bunkInsight,
    targetPct: settings.targetPct,
    bufferPct: settings.bufferPct,
    dayLabel: formatDayLabel(ymd),
    onboarded: settings.onboarded,
    holidayBlocked,
  };
}

function sessionLocalDate(session: {
  occurrenceKey: string;
  startsAt: string;
}): string {
  return sessionLocalYmd(session);
}

/**
 * Persist a mark. Cancelled / holiday go through series exceptions or
 * calendarBlocks so rematerialize cannot wipe them.
 */
export async function markDaySession(
  id: string,
  status: Exclude<MarkStatus, "unmarked">,
): Promise<void> {
  const { getSession, markAttendance, clearAttendance } = await import(
    "@/lib/db"
  );
  const session = await getSession(id);
  if (!session) return;

  if (status === "cancelled") {
    await clearAttendance(id);
    const { cancelSessionOccurrence } = await import("@/lib/timetable");
    await cancelSessionOccurrence(id, "Cancelled");
    return;
  }

  if (status === "holiday") {
    const date = sessionLocalDate(session);
    const { markDateAsHoliday } = await import("@/lib/timetable");
    await markDateAsHoliday(date, "Holiday");
    return;
  }

  // Restoring from cancelled/holiday before applying a normal mark
  if (session.status === "cancelled" || session.status === "holiday") {
    await restoreSessionToScheduled(session);
  }
  const markStatus =
    status === "on_duty" ? "on_duty" : (status as "present" | "absent");
  await markAttendance(id, markStatus);
}

async function restoreSessionToScheduled(
  session: NonNullable<
    Awaited<ReturnType<typeof import("@/lib/db").getSession>>
  >,
): Promise<void> {
  const { putSession, deleteExceptionForOccurrence } = await import("@/lib/db");
  const date = sessionLocalDate(session);
  if (session.seriesId) {
    await deleteExceptionForOccurrence(String(session.seriesId), date);
    const { ensureSessionsMaterialized } = await import("@/lib/timetable");
    await ensureSessionsMaterialized({ from: date, to: date });
    return;
  }
  await putSession({
    ...session,
    status: "scheduled",
    countsTowardAttendance: true,
    updatedAt: new Date().toISOString(),
  });
}

export async function undoDaySession(id: string): Promise<void> {
  const { getSession, clearAttendance } = await import("@/lib/db");
  const session = await getSession(id);
  if (!session) return;
  await clearAttendance(id);
  if (session.status === "cancelled" || session.status === "holiday") {
    await restoreSessionToScheduled(session);
  }
}

/** Clear a one-day holiday blackout (Calendar / empty holiday Today). */
export async function clearDayHoliday(ymd: string): Promise<void> {
  const { clearOneDayHoliday } = await import("@/lib/timetable");
  await clearOneDayHoliday(ymd);
}
