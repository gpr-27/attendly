import {
  getSettings,
  listAttendance,
  listCalendarBlocks,
  listSessions,
  listSubjects,
  type AttendanceRecord,
  type ClassSession,
} from "@/lib/db";
import {
  calculateSubjectStanding,
  countAttendanceFromMarks,
  countRemainingClasses,
  resolveCollegeTargetPct,
  type OdCountsAs,
} from "@/lib/attendance";
import { todayYmd } from "@/lib/dates";
import type { AiFocusSession, AiFocusSubject } from "@/lib/ai/ai-focus";

function mapOd(settingsOd: string | undefined): OdCountsAs {
  if (settingsOd === "present" || settingsOd === "absent") return settingsOd;
  return "exclude";
}

/**
 * Build a subject AiFocus from Dexie (standing + bunk math).
 * Returns null if the subject is missing.
 */
export async function loadSubjectFocus(
  subjectId: string,
): Promise<AiFocusSubject | null> {
  const [subjects, sessions, marks, settings, blocks] = await Promise.all([
    listSubjects(),
    listSessions(),
    listAttendance(),
    getSettings(),
    listCalendarBlocks(),
  ]);

  const subject = subjects.find((s) => String(s.id) === subjectId && !s.archived);
  if (!subject) return null;

  const sessionById = new Map<string, ClassSession>();
  for (const s of sessions) sessionById.set(String(s.id), s);

  const subjectMarks: Array<{
    markStatus: AttendanceRecord["status"];
    sessionStatus?: string;
    countsTowardAttendance?: boolean;
  }> = [];

  for (const mark of marks) {
    const session = sessionById.get(String(mark.sessionId));
    if (!session || String(session.subjectId) !== subjectId) continue;
    subjectMarks.push({
      markStatus: mark.status,
      sessionStatus: session.status,
      countsTowardAttendance: session.countsTowardAttendance,
    });
  }

  const od = mapOd(settings.odCountsAs as string | undefined);
  const { attended, total } = countAttendanceFromMarks(subjectMarks, od);
  const asOf = todayYmd();
  const semesterEnd = settings.semesterEnd?.trim() || undefined;
  const countableSessions = sessions.map((s) => ({
    subjectId: String(s.subjectId),
    startsAt: s.startsAt,
    status: s.status,
    countsTowardAttendance: s.countsTowardAttendance,
    sessionType: s.sessionType,
  }));
  const remaining = countRemainingClasses({
    sessions: countableSessions,
    asOfYmd: asOf,
    semesterEnd,
    subjectId,
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

  return {
    kind: "subject",
    subjectId,
    shortCode: subject.shortCode,
    name: subject.name,
    percentage: standing.percentage,
    risk: standing.risk,
    canBunk: standing.canSkipThisTerm,
    recover: standing.mustAttendThisTerm ?? standing.classesToRecover,
    attended: standing.attended,
    total: standing.total,
  };
}

/** Session focus enriched with subject bunk/recovery when available. */
export async function loadSessionFocus(options: {
  sessionId: string;
  subjectId: string;
  shortCode: string;
  name: string;
  startLabel: string;
  endLabel: string;
  ymd?: string;
}): Promise<AiFocusSession> {
  const subject = await loadSubjectFocus(options.subjectId);
  return {
    kind: "session",
    sessionId: options.sessionId,
    shortCode: options.shortCode,
    name: options.name,
    percentage: subject?.percentage ?? null,
    risk:
      subject?.risk === "Critical"
        ? "danger"
        : subject?.risk === "Warning"
          ? "watch"
          : subject?.risk === "Safe"
            ? "safe"
            : null,
    startLabel: options.startLabel,
    endLabel: options.endLabel,
    ymd: options.ymd,
    canBunk: subject?.canBunk,
    recover: subject?.recover,
    subjectId: options.subjectId,
  };
}
