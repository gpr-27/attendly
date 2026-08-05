import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addCalendarBlock,
  addSeries,
  addSubject,
  clearAllData,
  getSettings,
  listSeries,
  listSessions,
  saveSettings,
} from "@/lib/db";
import { applySemesterRange, materializeSessions } from "@/lib/timetable";

describe("semester range rematerializes full term", () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it("applySemesterRange backdates effectiveFrom and fills Jul Wed + Aug Mon/Tue", async () => {
    // Simulate the Aug 3 cutoff bug: onboard/import locked term to this week.
    await saveSettings({
      semesterName: "Odd 2026",
      semesterStart: "2026-08-03",
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
      dayOfWeek: 1, // Mon
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 2, // Tue
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 3, // Wed
      startTime: "10:30",
      endTime: "11:30",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    await materializeSessions({ from: "2026-08-03", to: "2026-08-09" });
    let dates = new Set(
      (await listSessions()).map((s) => s.occurrenceKey.split("#")[1]),
    );
    expect(dates.has("2026-07-29")).toBe(false);
    expect(dates.has("2026-08-03")).toBe(true);

    const result = await applySemesterRange({
      semesterStart: "2026-07-27",
      semesterEnd: "2026-12-15",
    });

    expect(result.seriesUpdated).toBe(3);
    const settings = await getSettings();
    expect(settings.semesterStart).toBe("2026-07-27");
    expect(settings.semesterEnd).toBe("2026-12-15");

    for (const s of await listSeries()) {
      expect(s.effectiveFrom).toBe("2026-07-27");
    }

    dates = new Set(
      (await listSessions()).map((s) => s.occurrenceKey.split("#")[1]),
    );
    // Wed Jul 29 is inside semester and has a Wed permanent slot
    expect(dates.has("2026-07-29")).toBe(true);
    // Aug 3 week Mon/Tue from permanent pattern
    expect(dates.has("2026-08-03")).toBe(true);
    expect(dates.has("2026-08-04")).toBe(true);
    expect(dates.has("2026-08-05")).toBe(true);
  });

  it("calendar suppress block still skips teaching days inside semester", async () => {
    await saveSettings({
      semesterStart: "2026-07-27",
      semesterEnd: "2026-08-07",
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
      dayOfWeek: 3,
      startTime: "10:00",
      endTime: "11:00",
      sessionType: "lecture",
      effectiveFrom: "2026-07-27",
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    await addCalendarBlock({
      title: "CT1",
      kind: "ct1",
      startsOn: "2026-07-29",
      endsOn: "2026-07-29",
      suppressesTeaching: true,
    });

    await applySemesterRange({
      semesterStart: "2026-07-27",
      semesterEnd: "2026-08-07",
    });

    const dates = new Set(
      (await listSessions()).map((s) => s.occurrenceKey.split("#")[1]),
    );
    expect(dates.has("2026-07-29")).toBe(false);
    expect(dates.has("2026-08-05")).toBe(true);
  });
});
