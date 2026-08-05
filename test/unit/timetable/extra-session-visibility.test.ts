import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addSubject,
  clearAllData,
  listSessionsInRange,
  saveSettings,
} from "@/lib/db";
import { dayBoundsIso, sessionLocalYmd } from "@/lib/dates";
import {
  addExtraSession,
  ensureSessionsMaterialized,
  materializeSessions,
} from "@/lib/timetable";
import { addSeries } from "@/lib/db";

/**
 * Mirrors Timetable day-list filtering: range query + sessionLocalYmd.
 * Regression: extras use occurrenceKey `extra#<uuid>` — must not treat uuid as date.
 */
describe("extra session day visibility", () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it("addExtraSession appears in that day's filtered list after rematerialize", async () => {
    const date = "2026-08-03"; // Monday
    await saveSettings({
      semesterName: "Vis",
      semesterStart: "2026-08-01",
      semesterEnd: "2026-08-31",
      workingDays: [1, 2, 3, 4, 5],
      onboarded: true,
    });

    const subject = await addSubject({
      name: "Mobile App Dev",
      shortCode: "CS532",
      color: "#2563eb",
    });

    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 1,
      startTime: "14:00",
      endTime: "15:00",
      sessionType: "lecture",
      weekParity: "all",
      effectiveFrom: "2026-08-01",
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    await materializeSessions({ from: date, to: date });

    const extra = await addExtraSession({
      subjectId: subject.id,
      date,
      startTime: "13:00",
      endTime: "14:00",
      sessionType: "lecture",
    });

    expect(extra.occurrenceKey.startsWith("extra#")).toBe(true);
    // Bug reproduction: naive split("#")[1] is a uuid, not the date.
    expect(extra.occurrenceKey.split("#")[1]).not.toBe(date);
    expect(sessionLocalYmd(extra)).toBe(date);

    await ensureSessionsMaterialized({ from: date, to: date });

    const bounds = dayBoundsIso(date);
    const inRange = await listSessionsInRange(bounds.fromIso, bounds.toIso);
    const dayList = inRange
      .filter((s) => sessionLocalYmd(s) === date)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    expect(dayList.map((s) => s.id)).toContain(extra.id);
    expect(dayList.some((s) => s.source === "extra")).toBe(true);
    expect(dayList.length).toBeGreaterThanOrEqual(2);
  });

  it("removeExtraSession deletes the extra and it leaves the day list", async () => {
    const date = "2026-08-06"; // Thursday
    await saveSettings({
      semesterName: "Vis",
      semesterStart: "2026-08-01",
      semesterEnd: "2026-08-31",
      workingDays: [1, 2, 3, 4, 5],
      onboarded: true,
    });

    const subject = await addSubject({
      name: "Machine Learning laboratory",
      shortCode: "CS403",
      color: "#0f6e6a",
    });

    const extra = await addExtraSession({
      subjectId: subject.id,
      date,
      startTime: "13:00",
      endTime: "14:00",
      sessionType: "lab",
    });

    const { removeExtraSession } = await import("@/lib/timetable");
    await removeExtraSession(extra.id);

    const bounds = dayBoundsIso(date);
    const inRange = await listSessionsInRange(bounds.fromIso, bounds.toIso);
    const dayList = inRange.filter((s) => sessionLocalYmd(s) === date);
    expect(dayList.map((s) => s.id)).not.toContain(extra.id);
  });
});
