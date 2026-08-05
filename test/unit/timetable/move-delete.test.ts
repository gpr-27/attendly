import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addSeries,
  addSubject,
  clearAllData,
  listExceptions,
  listSessions,
  saveSettings,
} from "@/lib/db";
import {
  cancelSeriesOccurrence,
  deleteCancelledOccurrence,
  materializeSessions,
  moveSessionOccurrence,
} from "@/lib/timetable";
import { loadDayAgenda } from "@/lib/today/load-day-agenda";

describe("delete cancelled + move session", () => {
  beforeEach(async () => {
    await clearAllData();
    await saveSettings({
      onboarded: true,
      semesterStart: "2026-08-03",
      semesterEnd: "2026-08-31",
      workingDays: [1, 2, 3, 4, 5],
      targetPct: 75,
      bufferPct: 0,
    });
  });

  afterEach(async () => {
    await clearAllData();
  });

  async function seedMonday() {
    const subject = await addSubject({
      name: "Networks",
      shortCode: "NET",
      color: "#16a34a",
    });
    const series = await addSeries({
      subjectId: subject.id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });
    await materializeSessions({ from: "2026-08-03", to: "2026-08-14" });
    return { subject, series };
  }

  it("deleteCancelledOccurrence hard-clears from day agenda", async () => {
    const { series } = await seedMonday();
    await cancelSeriesOccurrence(series.id, "2026-08-03", "Cancelled");

    const before = await loadDayAgenda("2026-08-03");
    const cancelled = before.items.find((i) => i.status === "cancelled");
    expect(cancelled).toBeTruthy();

    await deleteCancelledOccurrence(cancelled!.id);

    const after = await loadDayAgenda("2026-08-03");
    expect(after.items.find((i) => i.id === cancelled!.id)).toBeUndefined();
    expect(after.items.every((i) => i.status !== "cancelled")).toBe(true);

    const ex = await listExceptions();
    expect(ex.some((e) => e.type === "deleted")).toBe(true);

    // Survives rematerialize
    await materializeSessions({ from: "2026-08-03", to: "2026-08-03" });
    const again = await loadDayAgenda("2026-08-03");
    expect(again.items).toHaveLength(0);
  });

  it("move same day writes modified exception", async () => {
    await seedMonday();
    const session = (await listSessions()).find((s) =>
      s.occurrenceKey.endsWith("#2026-08-03"),
    );
    expect(session).toBeTruthy();

    await moveSessionOccurrence({
      sessionId: session!.id,
      newDate: "2026-08-03",
      startTime: "14:00",
      endTime: "15:00",
      scope: "this_date",
    });

    const ex = await listExceptions();
    expect(ex).toHaveLength(1);
    expect(ex[0]?.type).toBe("modified");
    expect(ex[0]?.newStartTime).toBe("14:00");

    const agenda = await loadDayAgenda("2026-08-03");
    expect(agenda.items[0]?.startHm).toBe("14:00");
  });

  it("move to another day clears original and adds extra", async () => {
    await seedMonday();
    const session = (await listSessions()).find((s) =>
      s.occurrenceKey.endsWith("#2026-08-03"),
    );

    const result = await moveSessionOccurrence({
      sessionId: session!.id,
      newDate: "2026-08-05",
      startTime: "11:00",
      endTime: "12:00",
      scope: "this_date",
    });

    expect(result.fromDate).toBe("2026-08-03");
    expect(result.toDate).toBe("2026-08-05");

    const mon = await loadDayAgenda("2026-08-03");
    expect(mon.items).toHaveLength(0);

    const wed = await loadDayAgenda("2026-08-05");
    expect(wed.items.some((i) => i.startHm === "11:00")).toBe(true);
  });

  it("entire_pattern updates master dayOfWeek", async () => {
    const { series } = await seedMonday();
    const session = (await listSessions()).find((s) =>
      s.occurrenceKey.endsWith("#2026-08-03"),
    );

    await moveSessionOccurrence({
      sessionId: session!.id,
      newDate: "2026-08-05",
      startTime: "10:00",
      endTime: "11:00",
      scope: "entire_pattern",
    });

    const { getSeries } = await import("@/lib/db");
    const updated = await getSeries(series.id);
    expect(updated?.dayOfWeek).toBe(3); // Wednesday
    expect(updated?.startTime).toBe("10:00");
  });
});
