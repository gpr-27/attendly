import {
  calculateSubjectStanding,
  countAttendanceFromMarks,
  countRemainingClasses,
  formatBunkInsight,
  resolveCollegeTargetPct,
  type OdCountsAs,
  type SubjectStanding,
} from "@/lib/attendance";
import { todayYmd } from "@/lib/dates";

export type SubjectStandingRow = {
  subjectId: string;
  name: string;
  shortCode: string;
  color: string;
  standing: SubjectStanding;
  bunkInsight: string;
  risk: "safe" | "watch" | "danger";
};

function mapOd(settingsOd: string | undefined): OdCountsAs {
  if (settingsOd === "present" || settingsOd === "absent") return settingsOd;
  return "exclude";
}

function toUiRisk(
  band: SubjectStanding["risk"],
): SubjectStandingRow["risk"] {
  if (band === "Safe") return "safe";
  if (band === "Warning") return "watch";
  return "danger";
}

/**
 * Per-subject eligibility vs college target (+ buffer).
 * Eligibility is never an overall average — each subject stands alone.
 */
export async function loadSubjectStandings(): Promise<{
  rows: SubjectStandingRow[];
  targetPct: number;
  bufferPct: number;
}> {
  const {
    getSettings,
    listSubjects,
    listSessions,
    listAttendance,
    listCalendarBlocks,
  } = await import("@/lib/db");
  const { ensureSessionsMaterialized } = await import("@/lib/timetable");

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

  const sessionById = new Map(sessions.map((s) => [String(s.id), s]));
  const countableSessions = sessions.map((s) => ({
    subjectId: String(s.subjectId),
    startsAt: s.startsAt,
    status: s.status,
    countsTowardAttendance: s.countsTowardAttendance,
    sessionType: s.sessionType,
  }));
  const asOf = todayYmd();
  const semesterEnd = settings.semesterEnd?.trim() || undefined;
  const od = mapOd(settings.odCountsAs as string | undefined);

  const marksBySubject = new Map<
    string,
    Array<{
      markStatus: (typeof marks)[number]["status"];
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

  const rows: SubjectStandingRow[] = [];

  for (const subject of subjects.filter((s) => !s.archived)) {
    const sid = String(subject.id);
    const { attended, total } = countAttendanceFromMarks(
      marksBySubject.get(sid) ?? [],
      od,
    );
    const remaining = countRemainingClasses({
      sessions: countableSessions,
      asOfYmd: asOf,
      semesterEnd,
      subjectId: sid,
      calendarBlocks: blocks,
    });
    const collegeTarget = resolveCollegeTargetPct({
      settingsTargetPct: settings.targetPct,
      subjectTargetPct: subject.targetPct,
    });
    const standing = calculateSubjectStanding(
      attended,
      total,
      {
        collegeTargetPct: collegeTarget,
        bufferPct: settings.bufferPct,
      },
      remaining,
    );
    rows.push({
      subjectId: sid,
      name: subject.name,
      shortCode: subject.shortCode,
      color: subject.color,
      standing,
      bunkInsight: formatBunkInsight(standing),
      risk: toUiRisk(standing.risk),
    });
  }

  rows.sort((a, b) => {
    const order = { danger: 0, watch: 1, safe: 2 } as const;
    const byRisk = order[a.risk] - order[b.risk];
    if (byRisk !== 0) return byRisk;
    const ap = a.standing.percentage ?? -1;
    const bp = b.standing.percentage ?? -1;
    return ap - bp;
  });

  return {
    rows,
    targetPct: settings.targetPct,
    bufferPct: settings.bufferPct,
  };
}

/** 2–3 scannable Analytics bullets from per-subject standing + streaks. */
export function buildAnalyticsKeyPoints(
  rows: SubjectStandingRow[],
  opts?: {
    presentStreak?: number;
    totalAbsences?: number;
  },
): Array<{ id: string; title: string; detail: string; tone: SubjectStandingRow["risk"] | "neutral" }> {
  const points: Array<{
    id: string;
    title: string;
    detail: string;
    tone: SubjectStandingRow["risk"] | "neutral";
  }> = [];

  if (rows.length === 0) {
    return [
      {
        id: "empty",
        title: "No subjects yet",
        detail: "Add a timetable, then mark classes — eligibility is per subject vs 75%.",
        tone: "neutral",
      },
    ];
  }

  const atRisk = rows.filter((r) => r.risk !== "safe");
  const withMarks = rows.filter((r) => r.standing.total > 0);

  if (atRisk.length > 0) {
    const names = atRisk
      .slice(0, 3)
      .map((r) => r.name)
      .join(", ");
    points.push({
      id: "at-risk",
      title:
        atRisk.length === 1
          ? "1 subject needs attention"
          : `${atRisk.length} subjects need attention`,
      detail: `${names}${atRisk.length > 3 ? "…" : ""} — each must stay ≥ its own target (not an overall average).`,
      tone: atRisk.some((r) => r.risk === "danger") ? "danger" : "watch",
    });
  } else if (withMarks.length > 0) {
    points.push({
      id: "all-safe",
      title: "All subjects at target",
      detail: `Every subject with marks is at or above its eligibility line (${rows[0]?.standing.collegeTargetPct ?? 75}% + buffer).`,
      tone: "safe",
    });
  } else {
    points.push({
      id: "no-marks",
      title: "Mark to unlock risk",
      detail: "Subjects are listed below — % and bunk room appear after your first counted classes.",
      tone: "neutral",
    });
  }

  const ranked = [...withMarks].sort(
    (a, b) => (b.standing.percentage ?? 0) - (a.standing.percentage ?? 0),
  );
  if (ranked.length >= 2) {
    const best = ranked[0]!;
    const worst = ranked[ranked.length - 1]!;
    points.push({
      id: "best-worst",
      title: `${best.name} strongest · ${worst.name} lowest`,
      detail: `${best.name} ${Math.round(best.standing.percentage!)}% · ${worst.name} ${Math.round(worst.standing.percentage!)}% (each vs its own ${best.standing.collegeTargetPct}% target).`,
      tone: worst.risk,
    });
  } else if (ranked.length === 1) {
    const only = ranked[0]!;
    points.push({
      id: "one-subject",
      title: `${only.name} at ${Math.round(only.standing.percentage!)}%`,
      detail: only.bunkInsight,
      tone: only.risk,
    });
  }

  const bunkRoom = rows.reduce(
    (sum, r) => sum + Math.max(0, r.standing.canSkipThisTerm),
    0,
  );
  const streak = opts?.presentStreak ?? 0;
  if (streak > 0 || bunkRoom > 0) {
    points.push({
      id: "bunk-streak",
      title:
        streak > 0
          ? `${streak}-day clean present streak`
          : `${bunkRoom} bunk${bunkRoom === 1 ? "" : "s"} left across subjects`,
      detail:
        streak > 0 && bunkRoom > 0
          ? `Combined bunk room ≈ ${bunkRoom} (sum of per-subject skips). Keep marking to stay accurate.`
          : streak > 0
            ? "Days with ≥1 present and no absents. Subject eligibility still judged separately."
            : "Sum of per-subject term bunks — skipping one subject never “borrows” from another.",
      tone: streak > 0 ? "safe" : "neutral",
    });
  }

  return points.slice(0, 3);
}
