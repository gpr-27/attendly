import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addSeries,
  addSubject,
  clearAllData,
  listExceptions,
  listSeries,
  listSessions,
  saveSettings,
} from "@/lib/db";
import {
  applySeriesCancel,
  applySeriesEdit,
  materializeSessions,
} from "@/lib/timetable";

describe("edit-series-scope", () => {
  beforeEach(async () => {
    await clearAllData();
    await saveSettings({
      onboarded: true,
      semesterStart: "2026-08-03",
      semesterEnd: "2026-08-31",
      workingDays: [1, 2, 3, 4, 5],
    });
  });

  afterEach(async () => {
    await clearAllData();
  });

  async function seedMondaySlot() {
    const subject = await addSubject({
      name: "Algorithms",
      shortCode: "ALG",
      color: "#2563EB",
    });
    const series = await addSeries({
      subjectId: subject.id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      location: "LH-1",
      sessionType: "lecture",
      weekParity: "all",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });
    return { subject, series };
  }

  it("this_date writes a modified exception only", async () => {
    const { series } = await seedMondaySlot();
    await applySeriesEdit({
      series,
      patch: { startTime: "11:00", endTime: "12:00", location: "LH-2" },
      scope: "this_date",
      date: "2026-08-10",
    });

    const slots = await listSeries();
    expect(slots).toHaveLength(1);
    expect(slots[0]?.startTime).toBe("09:00");

    const exceptions = await listExceptions();
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]?.type).toBe("modified");
    expect(exceptions[0]?.newStartTime).toBe("11:00");
    expect(exceptions[0]?.date).toBe("2026-08-10");
  });

  it("entire_pattern updates the master series", async () => {
    const { series } = await seedMondaySlot();
    await applySeriesEdit({
      series,
      patch: { startTime: "14:00", endTime: "15:00", location: "Lab" },
      scope: "entire_pattern",
      date: "2026-08-10",
    });

    const slots = await listSeries();
    expect(slots).toHaveLength(1);
    expect(slots[0]?.startTime).toBe("14:00");
    expect(slots[0]?.location).toBe("Lab");
  });

  it("all_future splits the series from the chosen date", async () => {
    const { series } = await seedMondaySlot();
    const result = await applySeriesEdit({
      series,
      patch: { startTime: "13:00", endTime: "14:00" },
      scope: "all_future",
      date: "2026-08-17",
    });

    expect(result.newSeriesId).toBeTruthy();
    const slots = await listSeries();
    expect(slots).toHaveLength(2);

    const old = slots.find((s) => String(s.id) === String(series.id));
    const neu = slots.find((s) => String(s.id) === result.newSeriesId);
    expect(old?.effectiveTo).toBe("2026-08-16");
    expect(old?.startTime).toBe("09:00");
    expect(neu?.effectiveFrom).toBe("2026-08-17");
    expect(neu?.startTime).toBe("13:00");

    await materializeSessions({ from: "2026-08-03", to: "2026-08-24" });
    const sessions = await listSessions();
    const aug10 = sessions.find((s) => s.occurrenceKey.endsWith("#2026-08-10"));
    const aug17 = sessions.find((s) => s.occurrenceKey.endsWith("#2026-08-17"));
    expect(aug10?.seriesId).toBe(String(series.id));
    expect(aug17?.seriesId).toBe(result.newSeriesId);
    expect(new Date(aug10!.startsAt).getHours()).toBe(9);
    expect(new Date(aug17!.startsAt).getHours()).toBe(13);
  });

  it("cancel this_date adds cancelled exception", async () => {
    const { series } = await seedMondaySlot();
    await applySeriesCancel({
      series,
      scope: "this_date",
      date: "2026-08-10",
    });
    const exceptions = await listExceptions();
    expect(exceptions[0]?.type).toBe("cancelled");
    expect(await listSeries()).toHaveLength(1);
  });

  it("cancel entire_pattern deletes the weekly slot", async () => {
    const { series } = await seedMondaySlot();
    await applySeriesCancel({
      series,
      scope: "entire_pattern",
      date: "2026-08-10",
    });
    expect(await listSeries()).toHaveLength(0);
  });
});
