import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addCalendarBlock,
  addSeries,
  addSubject,
  clearAllData,
  listExceptions,
  listSessions,
  saveSettings,
} from "@/lib/db";
import {
  cancelSeriesOccurrence,
  ensureSessionsMaterialized,
  markDateAsHoliday,
  materializeSessions,
} from "@/lib/timetable";
import {
  loadDayAgenda,
  markDaySession,
  undoDaySession,
} from "@/lib/today/load-day-agenda";

describe("cancel session + holiday blackout", () => {
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
    await materializeSessions({ from: "2026-08-03", to: "2026-08-10" });
    return { subject, series };
  }

  it("cancelSeriesOccurrence persists after rematerialize", async () => {
    const { series } = await seedMonday();
    await cancelSeriesOccurrence(series.id, "2026-08-03", "Cancelled");

    await ensureSessionsMaterialized({
      from: "2026-08-03",
      to: "2026-08-10",
    });

    const sessions = await listSessions();
    const target = sessions.find((s) =>
      s.occurrenceKey.endsWith("#2026-08-03"),
    );
    expect(target?.status).toBe("cancelled");
    expect(target?.countsTowardAttendance).toBe(false);

    const later = sessions.find((s) =>
      s.occurrenceKey.endsWith("#2026-08-10"),
    );
    expect(later?.status).toBe("scheduled");
    expect(later?.countsTowardAttendance).toBe(true);

    const exceptions = await listExceptions();
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]?.type).toBe("cancelled");
  });

  it("Today cancel mark writes exception and survives rematerialize", async () => {
    await seedMonday();
    const before = await listSessions();
    const session = before.find((s) =>
      s.occurrenceKey.endsWith("#2026-08-03"),
    );
    expect(session).toBeTruthy();

    await markDaySession(session!.id, "cancelled");
    await ensureSessionsMaterialized({
      from: "2026-08-03",
      to: "2026-08-03",
    });

    const agenda = await loadDayAgenda("2026-08-03");
    const item = agenda.items.find((i) => i.id === session!.id);
    expect(item?.status).toBe("cancelled");
    expect(await listExceptions()).toHaveLength(1);
  });

  it("undo cancel removes exception and restores scheduled", async () => {
    await seedMonday();
    const session = (await listSessions()).find((s) =>
      s.occurrenceKey.endsWith("#2026-08-03"),
    );
    await markDaySession(session!.id, "cancelled");
    await undoDaySession(session!.id);

    expect(await listExceptions()).toHaveLength(0);
    const restored = (await listSessions()).find((s) =>
      s.occurrenceKey.endsWith("#2026-08-03"),
    );
    expect(restored?.status).toBe("scheduled");
    expect(restored?.countsTowardAttendance).toBe(true);
  });

  it("holiday calendar block excludes sessions from materialize", async () => {
    await seedMonday();
    await addCalendarBlock({
      kind: "holiday",
      title: "Independence Day",
      startsOn: "2026-08-03",
      endsOn: "2026-08-03",
      suppressesTeaching: true,
    });

    await materializeSessions({ from: "2026-08-03", to: "2026-08-10" });
    const sessions = await listSessions();
    expect(
      sessions.some((s) => s.occurrenceKey.endsWith("#2026-08-03")),
    ).toBe(false);
    expect(
      sessions.some((s) => s.occurrenceKey.endsWith("#2026-08-10")),
    ).toBe(true);
  });

  it("markDateAsHoliday blackout clears the day agenda", async () => {
    await seedMonday();
    await markDateAsHoliday("2026-08-03", "Holiday");

    const agenda = await loadDayAgenda("2026-08-03");
    expect(agenda.holidayBlocked).toBe(true);
    expect(agenda.items).toHaveLength(0);

    const later = await loadDayAgenda("2026-08-10");
    expect(later.holidayBlocked).toBe(false);
    expect(later.items.length).toBeGreaterThan(0);
  });

  it("Today holiday mark suppresses the whole day", async () => {
    await seedMonday();
    const session = (await listSessions()).find((s) =>
      s.occurrenceKey.endsWith("#2026-08-03"),
    );
    await markDaySession(session!.id, "holiday");

    const agenda = await loadDayAgenda("2026-08-03");
    expect(agenda.holidayBlocked).toBe(true);
    expect(agenda.items).toHaveLength(0);
  });
});
