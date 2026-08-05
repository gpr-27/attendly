import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addSeries,
  addSubject,
  clearAllData,
  getSettings,
  listSessions,
  saveSettings,
} from "@/lib/db";
import {
  ensureSessionsMaterialized,
  materializeSessions,
  repairMidWeekSemesterStart,
} from "@/lib/timetable";
import { mondayOfWeekYmd } from "@/lib/dates";

describe("mid-week semester start → Mon/Tue materialize", () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it("skips Mon/Tue when effectiveFrom is Wednesday (pre-repair)", async () => {
    await saveSettings({
      semesterName: "Midweek",
      semesterStart: "2026-08-05",
      semesterEnd: "2026-08-09",
      workingDays: [1, 2, 3, 4, 5, 6],
      onboarded: true,
    });

    const subject = await addSubject({
      name: "Machine Learning",
      shortCode: "CS402",
      color: "#0f6e6a",
    });

    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 1,
      startTime: "10:30",
      endTime: "11:30",
      sessionType: "lecture",
      effectiveFrom: "2026-08-05",
      effectiveTo: null,
      countsTowardAttendance: true,
    });
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 3,
      startTime: "10:30",
      endTime: "11:30",
      sessionType: "lecture",
      effectiveFrom: "2026-08-05",
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    await materializeSessions({ from: "2026-08-03", to: "2026-08-09" });
    const sessions = await listSessions();
    const dates = sessions.map((s) => s.occurrenceKey.split("#")[1]).sort();
    expect(dates).toEqual(["2026-08-05"]);
    expect(dates).not.toContain("2026-08-03");
  });

  it("repairMidWeekSemesterStart backdates to Monday and rematerializes Mon", async () => {
    await saveSettings({
      semesterName: "Midweek",
      semesterStart: "2026-08-05",
      semesterEnd: "2026-08-09",
      workingDays: [1, 2, 3, 4, 5, 6],
      onboarded: true,
    });

    const subject = await addSubject({
      name: "Machine Learning",
      shortCode: "CS402",
      color: "#0f6e6a",
    });

    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 1,
      startTime: "10:30",
      endTime: "11:30",
      sessionType: "lecture",
      effectiveFrom: "2026-08-05",
      effectiveTo: null,
      countsTowardAttendance: true,
    });
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 2,
      startTime: "09:20",
      endTime: "10:20",
      sessionType: "lecture",
      effectiveFrom: "2026-08-05",
      effectiveTo: null,
      countsTowardAttendance: true,
    });
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 3,
      startTime: "10:30",
      endTime: "11:30",
      sessionType: "lecture",
      effectiveFrom: "2026-08-05",
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    const repaired = await repairMidWeekSemesterStart();
    expect(repaired.repaired).toBe(true);
    expect(repaired.to).toBe("2026-08-03");

    const settings = await getSettings();
    expect(settings.semesterStart).toBe("2026-08-03");

    await materializeSessions({ from: "2026-08-03", to: "2026-08-09" });
    const sessions = await listSessions();
    const dates = new Set(
      sessions.map((s) => s.occurrenceKey.split("#")[1]),
    );
    expect(dates.has("2026-08-03")).toBe(true);
    expect(dates.has("2026-08-04")).toBe(true);
    expect(dates.has("2026-08-05")).toBe(true);
  });

  it("ensureSessionsMaterialized runs repair then creates Mon session", async () => {
    await saveSettings({
      semesterName: "Midweek",
      semesterStart: "2026-08-05",
      semesterEnd: "2026-08-09",
      workingDays: [1, 2, 3, 4, 5, 6],
      onboarded: true,
    });

    const subject = await addSubject({
      name: "Algorithms",
      shortCode: "ALG",
      color: "#2563eb",
    });

    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-05",
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    await ensureSessionsMaterialized({
      from: "2026-08-03",
      to: "2026-08-09",
    });

    const settings = await getSettings();
    expect(settings.semesterStart).toBe(mondayOfWeekYmd("2026-08-05"));

    const sessions = await listSessions();
    expect(
      sessions.some((s) => s.occurrenceKey.endsWith("#2026-08-03")),
    ).toBe(true);
  });

  it("does not snap when no earlier-weekday series exist", async () => {
    await saveSettings({
      semesterStart: "2026-08-05",
      semesterEnd: "2026-12-01",
      workingDays: [1, 2, 3, 4, 5],
      onboarded: true,
    });

    const subject = await addSubject({
      name: "Only Wed",
      shortCode: "WED",
      color: "#111",
    });
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 3,
      startTime: "10:00",
      endTime: "11:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-05",
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    const repaired = await repairMidWeekSemesterStart();
    expect(repaired.repaired).toBe(false);
    expect((await getSettings()).semesterStart).toBe("2026-08-05");
  });
});
