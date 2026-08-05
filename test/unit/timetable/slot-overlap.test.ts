import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addSeries,
  addSubject,
  clearAllData,
  saveSettings,
} from "@/lib/db";
import {
  addExtraSession,
  findDaySlotOverlaps,
  formatOccupancyTooltip,
  formatTakenChipLabel,
  getPeriodSlotsOccupancy,
  materializeSessions,
  timesOverlap,
} from "@/lib/timetable";
import { defaultPeriodSlots } from "@/lib/db/types";

describe("slot overlap", () => {
  beforeEach(async () => {
    await clearAllData();
  });
  afterEach(async () => {
    await clearAllData();
  });

  it("timesOverlap detects half-open interval conflicts", () => {
    expect(timesOverlap("09:00", "10:00", "09:30", "10:30")).toBe(true);
    expect(timesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
    expect(timesOverlap("10:00", "11:00", "09:00", "10:00")).toBe(false);
  });

  it("blocks placing a second class on the same day+period", async () => {
    await saveSettings({
      semesterStart: "2026-08-03",
      semesterEnd: "2026-08-10",
      workingDays: [1, 2, 3, 4, 5],
      onboarded: true,
    });
    const a = await addSubject({
      name: "ML",
      shortCode: "CS402",
      color: "#0f6e6a",
    });
    const b = await addSubject({
      name: "OS",
      shortCode: "CS401",
      color: "#2563eb",
    });
    await addSeries({
      subjectId: a.id,
      dayOfWeek: 3,
      startTime: "10:30",
      endTime: "11:30",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });
    await materializeSessions({ from: "2026-08-05", to: "2026-08-05" });

    const overlap = await findDaySlotOverlaps({
      date: "2026-08-05",
      startTime: "10:30",
      endTime: "11:30",
    });
    expect(overlap.ok).toBe(false);
    if (!overlap.ok) {
      expect(overlap.message).toMatch(/already going on/i);
      expect(overlap.conflicts[0]?.name).toBe("ML");
      expect(overlap.conflicts[0]?.shortCode).toBe("CS402");
    }

    // Different period — ok
    const free = await findDaySlotOverlaps({
      date: "2026-08-05",
      startTime: "14:00",
      endTime: "15:00",
    });
    expect(free.ok).toBe(true);

    await addExtraSession({
      subjectId: b.id,
      date: "2026-08-05",
      startTime: "14:00",
      endTime: "15:00",
    });
    const again = await findDaySlotOverlaps({
      date: "2026-08-05",
      startTime: "14:00",
      endTime: "15:00",
    });
    expect(again.ok).toBe(false);
  });

  it("marks occupied period chips taken with subject name tooltip", async () => {
    await saveSettings({
      semesterStart: "2026-08-03",
      semesterEnd: "2026-08-10",
      workingDays: [1, 2, 3, 4, 5],
      periodSlots: [
        { label: "Slot 1", startTime: "09:20", endTime: "10:20" },
        { label: "Slot 2", startTime: "10:30", endTime: "11:30" },
        { label: "Slot 3", startTime: "14:00", endTime: "15:00" },
      ],
      onboarded: true,
    });
    const a = await addSubject({
      name: "Machine Learning",
      shortCode: "CS402",
      color: "#0f6e6a",
    });
    await addSeries({
      subjectId: a.id,
      dayOfWeek: 3,
      startTime: "10:30",
      endTime: "11:30",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });
    await materializeSessions({ from: "2026-08-05", to: "2026-08-05" });

    const settingsSlots = [
      { label: "Slot 1", startTime: "09:20", endTime: "10:20" },
      { label: "Slot 2", startTime: "10:30", endTime: "11:30" },
      { label: "Slot 3", startTime: "14:00", endTime: "15:00" },
    ];
    const occ = await getPeriodSlotsOccupancy({
      date: "2026-08-05",
      slots: settingsSlots,
    });
    expect(occ[0]?.taken).toBe(false);
    expect(occ[0]?.tooltip).toBe("Free");
    expect(occ[1]?.taken).toBe(true);
    expect(occ[1]?.takenLabel).toMatch(/Machine Learning/);
    expect(occ[1]?.tooltip).toBe("Machine Learning · 10:30–11:30");
    expect(formatTakenChipLabel(occ[1]!.occupants)).toBe(
      "Taken · Machine Learning",
    );
    expect(formatOccupancyTooltip([])).toBe("Free");
    expect(defaultPeriodSlots().length).toBeGreaterThan(0);
  });
});
