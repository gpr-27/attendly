import {
  calculateSubjectStanding,
  countAttendanceFromMarks,
  countRemainingClasses,
  resolveCollegeTargetPct,
  type OdCountsAs,
} from "@/lib/attendance";
import { todayYmd } from "@/lib/dates";
import {
  getSettings,
  listAttendance,
  listCalendarBlocks,
  listSessions,
  listSubjects,
  type AttendanceRecord,
  type ClassSession,
} from "@/lib/db";
import { ensureSessionsMaterialized } from "@/lib/timetable";

function mapOd(settingsOd: string | undefined): OdCountsAs {
  if (settingsOd === "present" || settingsOd === "absent") return settingsOd;
  return "exclude";
}

/**
 * Build grounded coach stats from Dexie.
 * Always returns a valid payload — zeros + note when empty (chat still works).
 */
export async function buildCoachStats(): Promise<Record<string, unknown>> {
  try {
    await ensureSessionsMaterialized();
  } catch {
    /* Rem forecast best-effort */
  }

  const [subjects, sessions, marks, settings, blocks] = await Promise.all([
    listSubjects(),
    listSessions(),
    listAttendance(),
    getSettings(),
    listCalendarBlocks(),
  ]);

  const sessionById = new Map<string, ClassSession>();
  for (const s of sessions) sessionById.set(String(s.id), s);

  const countableSessions = sessions.map((s) => ({
    subjectId: String(s.subjectId),
    startsAt: s.startsAt,
    status: s.status,
    countsTowardAttendance: s.countsTowardAttendance,
    sessionType: s.sessionType,
  }));
  const asOf = todayYmd();
  const semesterEnd = settings.semesterEnd?.trim() || undefined;

  const marksBySubject = new Map<
    string,
    Array<{
      markStatus: AttendanceRecord["status"];
      sessionStatus?: string;
      countsTowardAttendance?: boolean;
    }>
  >();

  for (const mark of marks) {
    const session = sessionById.get(String(mark.sessionId));
    if (!session) continue;
    const sid = String(session.subjectId);
    const list = marksBySubject.get(sid) ?? [];
    list.push({
      markStatus: mark.status,
      sessionStatus: session.status,
      countsTowardAttendance: session.countsTowardAttendance,
    });
    marksBySubject.set(sid, list);
  }

  const od = mapOd(settings.odCountsAs as string | undefined);
  const active = subjects.filter((s) => !s.archived);
  const subjectRows: unknown[] = [];

  let totalAttended = 0;
  let totalCounted = 0;

  for (const subject of active) {
    const sid = String(subject.id);
    const { attended, total } = countAttendanceFromMarks(
      marksBySubject.get(sid) ?? [],
      od,
    );
    totalAttended += attended;
    totalCounted += total;
    const remaining = countRemainingClasses({
      sessions: countableSessions,
      asOfYmd: asOf,
      semesterEnd,
      subjectId: sid,
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
    subjectRows.push({
      subjectId: sid,
      shortCode: subject.shortCode,
      name: subject.name,
      attended,
      total,
      remaining,
      percentage: standing.percentage,
      risk: standing.risk,
      canBunk: standing.canSkipThisTerm,
      canBunkUnlimited: standing.classesYouCanSkip,
      recover: standing.mustAttendThisTerm ?? standing.classesToRecover,
      bunkInsight: `${standing.percentage == null ? "—" : `${Math.round(standing.percentage)}%`} · rem ${remaining} · skip ${standing.canSkipThisTerm}`,
    });
  }

  const empty = active.length === 0 || totalCounted === 0;

  type SubjectRow = {
    subjectId: string;
    shortCode: string;
    name: string;
    attended: number;
    total: number;
    remaining: number;
    percentage: number;
    risk: string;
    canBunk: number;
    recover: number;
  };

  const typedSubjects = subjectRows as SubjectRow[];
  const riskOrder = { Critical: 0, Warning: 1, Safe: 2 } as const;
  const protectThisWeek = [...typedSubjects]
    .sort((a, b) => {
      const ra = riskOrder[a.risk as keyof typeof riskOrder] ?? 9;
      const rb = riskOrder[b.risk as keyof typeof riskOrder] ?? 9;
      if (ra !== rb) return ra - rb;
      return a.percentage - b.percentage;
    })
    .slice(0, 5)
    .map((s) => ({
      shortCode: s.shortCode,
      risk: s.risk,
      percentage: s.percentage,
      canBunk: s.canBunk,
      recover: s.recover,
      remaining: s.remaining,
    }));

  return {
    targetPct: settings.targetPct,
    bufferPct: settings.bufferPct,
    semesterName: settings.semesterName || null,
    subjectCount: active.length,
    /** Fixed daily periods from Settings — cite slotIndex 0…n-1 when suggesting add-class. */
    periodSlots: (settings.periodSlots ?? []).map((p, slotIndex) => ({
      slotIndex,
      label: p.label,
      startTime: p.startTime,
      endTime: p.endTime,
    })),
    seriesHint:
      "Attendance numbers come from the user's local Dexie marks. Rules own the math. Prefer term-bounded canBunk (remaining classes) over unlimited. When suggesting a new class, prefer periodSlots.slotIndex over inventing times.",
    empty,
    note: empty
      ? "User has no attendance marks yet (or no subjects). Explain how to set up a timetable / import a photo / mark classes. Do not invent percentages."
      : undefined,
    overall: {
      attended: totalAttended,
      total: totalCounted,
      percentage:
        totalCounted === 0
          ? null
          : Math.round((totalAttended / totalCounted) * 1000) / 10,
    },
    subjects: subjectRows,
    /** Pre-sorted from local rules — coach may cite these, never invent others. */
    protectThisWeek,
  };
}
