import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addSeries,
  addSubject,
  clearAllData,
  getSettings,
  listSeries,
  listSessions,
  listSubjects,
  saveSettings,
} from "@/lib/db";
import {
  ensureSemesterRange,
  ensureSessionsMaterialized,
  materializeSessions,
} from "@/lib/timetable";

/**
 * Pure manual entry path: subject → weekly series → materialize.
 * No AI import, no seed data.
 */
describe("manual timetable add", () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it("fills missing semester dates then materializes today's slot", async () => {
    await saveSettings({
      onboarded: true,
      semesterStart: "",
      semesterEnd: "",
      workingDays: [1, 2, 3, 4, 5, 6],
    });

    const range = await ensureSemesterRange();
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.to >= range.from).toBe(true);
    expect(range.filledMissing).toBe(true);

    const settings = await getSettings();
    expect(settings.semesterStart).toBe(range.from);
    expect(settings.semesterEnd).toBe(range.to);

    const subject = await addSubject({
      name: "Operating Systems",
      shortCode: "OS",
      color: "#0D9488",
    });
    expect((await listSubjects()).map((s) => s.shortCode)).toContain("OS");

    const today = new Date();
    const dayOfWeek = today.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    await addSeries({
      subjectId: subject.id,
      dayOfWeek,
      startTime: "10:00",
      endTime: "11:00",
      sessionType: "lecture",
      effectiveFrom: range.from,
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    expect(await listSeries()).toHaveLength(1);

    const fresh = await getSettings();
    const result = await ensureSessionsMaterialized({ from: ymd, to: ymd });
    // Only upserts if today is a working day matching the series
    const working = new Set(fresh.workingDays);
    if (working.has(dayOfWeek)) {
      expect(result.upserted).toBeGreaterThanOrEqual(1);
      const sessions = await listSessions();
      expect(sessions.some((s) => s.subjectId === subject.id)).toBe(true);
    }
  });

  it("add subject + series for a fixed Monday without AI", async () => {
    await saveSettings({
      onboarded: true,
      semesterStart: "2026-08-03",
      semesterEnd: "2026-08-07",
      workingDays: [1, 2, 3, 4, 5],
    });

    const subject = await addSubject({
      name: "Algorithms",
      shortCode: "ALG",
      color: "#2563EB",
    });

    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      location: "LH-1",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    const result = await materializeSessions({
      from: "2026-08-03",
      to: "2026-08-07",
    });
    expect(result.upserted).toBe(1);

    const sessions = await listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.location).toBe("LH-1");
    expect(sessions[0]?.subjectId).toBe(subject.id);
  });
});
