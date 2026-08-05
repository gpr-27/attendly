import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addSeries,
  addSubject,
  clearAllData,
  exportBackup,
  getAttendanceForSession,
  importBackup,
  listAttendance,
  listSessions,
  listSubjects,
  markAttendance,
  saveSettings,
} from "@/lib/db";
import { materializeSessions } from "@/lib/timetable";
import {
  calculateSubjectStanding,
  countAttendanceFromMarks,
  type OdCountsAs,
} from "@/lib/attendance";
import { mapOdPolicy } from "@/lib/today-types";

/**
 * End-to-end business flow against real Dexie + materializer + bunk math.
 * No app seed data — every row is created inside the test.
 */
describe("attendance business flow", () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it("settings → subjects → series → materialize → mark → standing", async () => {
    // 1) Settings (semester week Mon–Fri, college 75% + 2 buffer)
    await saveSettings({
      semesterName: "Test Term",
      semesterStart: "2026-08-03", // Monday
      semesterEnd: "2026-08-07", // Friday
      targetPct: 75,
      bufferPct: 2,
      workingDays: [1, 2, 3, 4, 5],
      odCountsAs: "excused",
      onboarded: true,
    });

    // 2) Subject
    const subject = await addSubject({
      name: "Algorithms",
      shortCode: "ALG",
      color: "#2563eb",
    });

    // 3) Weekly series — Monday + Wednesday morning
    const monday = await addSeries({
      subjectId: subject.id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 3,
      startTime: "11:00",
      endTime: "12:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    // 4) Materialize the week → two sessions (Mon + Wed)
    const result = await materializeSessions({
      from: "2026-08-03",
      to: "2026-08-07",
    });
    expect(result.upserted).toBe(2);

    const sessions = await listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.subjectId === subject.id)).toBe(true);
    expect(sessions.every((s) => s.seriesId === monday.id || s.seriesId)).toBe(
      true,
    );

    // 5) Mark: present Monday, absent Wednesday
    const byDay = [...sessions].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );
    await markAttendance(byDay[0]!.id, "present");
    await markAttendance(byDay[1]!.id, "absent");

    const monMark = await getAttendanceForSession(byDay[0]!.id);
    const wedMark = await getAttendanceForSession(byDay[1]!.id);
    expect(monMark?.status).toBe("present");
    expect(wedMark?.status).toBe("absent");

    // 6) Standing from marks + settings
    const od: OdCountsAs = mapOdPolicy("excused");
    const { attended, total } = countAttendanceFromMarks(
      [
        {
          markStatus: "present",
          sessionStatus: byDay[0]!.status,
          countsTowardAttendance: byDay[0]!.countsTowardAttendance,
        },
        {
          markStatus: "absent",
          sessionStatus: byDay[1]!.status,
          countsTowardAttendance: byDay[1]!.countsTowardAttendance,
        },
      ],
      od,
    );

    expect(attended).toBe(1);
    expect(total).toBe(2);

    const standing = calculateSubjectStanding(
      attended,
      total,
      { collegeTargetPct: 75, bufferPct: 2 },
      8,
    );

    expect(standing.percentage).toBe(50);
    expect(standing.effectiveTargetPct).toBe(77);
    expect(standing.risk).toBe("Critical");
    expect(standing.classesYouCanSkip).toBe(0);
    expect(standing.classesToRecover).toBeGreaterThan(0);

    // 7) Export → clear → import restores schedule (marks intentionally omitted)
    const backup = await exportBackup();
    expect(backup.subjects).toHaveLength(1);
    expect(backup.classSessions).toHaveLength(2);
    expect(backup.attendanceRecords).toHaveLength(0);
    expect(backup.scope).toBe("schedule");

    await clearAllData();
    expect(await listSubjects()).toHaveLength(0);
    expect(await listSessions()).toHaveLength(0);
    expect(await listAttendance()).toHaveLength(0);

    await importBackup(backup);
    expect(await listSubjects()).toHaveLength(1);
    expect((await listSessions()).length).toBeGreaterThanOrEqual(2);
    expect(await listAttendance()).toHaveLength(0);

    // Marks were not restored — standing inputs need fresh marks.
    const restoredMarks = await listAttendance();
    expect(restoredMarks).toHaveLength(0);
  });

  it("starts empty with no seed subjects or sessions", async () => {
    expect(await listSubjects()).toHaveLength(0);
    expect(await listSessions()).toHaveLength(0);
    expect(await listAttendance()).toHaveLength(0);
  });

  it("cancelled series occurrence drops out of A/T", async () => {
    await saveSettings({
      semesterStart: "2026-08-03",
      semesterEnd: "2026-08-03",
      workingDays: [1, 2, 3, 4, 5],
      targetPct: 75,
      bufferPct: 0,
      onboarded: true,
    });

    const subject = await addSubject({
      name: "Networks",
      shortCode: "NET",
      color: "#16a34a",
    });

    const series = await addSeries({
      subjectId: subject.id,
      dayOfWeek: 1,
      startTime: "14:00",
      endTime: "15:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      countsTowardAttendance: true,
    });

    await materializeSessions({ from: "2026-08-03", to: "2026-08-03" });
    let sessions = await listSessions();
    expect(sessions).toHaveLength(1);

    const { cancelSeriesOccurrence } = await import("@/lib/timetable");
    await cancelSeriesOccurrence(series.id, "2026-08-03", "holiday makeup");

    sessions = await listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.status).toBe("cancelled");
    expect(sessions[0]!.countsTowardAttendance).toBe(false);

    await markAttendance(sessions[0]!.id, "present");

    const { attended, total } = countAttendanceFromMarks(
      [
        {
          markStatus: "present",
          sessionStatus: sessions[0]!.status,
          countsTowardAttendance: sessions[0]!.countsTowardAttendance,
        },
      ],
      "exclude",
    );
    expect(attended).toBe(0);
    expect(total).toBe(0);
  });
});
