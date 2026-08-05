import { describe, expect, it } from "vitest";
import { defaultPeriodSlots } from "@/lib/db/types";
import {
  ensurePeriodSlotsCover,
  matchPeriodSlotIndex,
  normalizePeriodSlots,
  resolvePeriodSlot,
  timesFromSlotIndex,
  validatePeriodSlots,
} from "@/lib/timetable/period-slots";

describe("period slots", () => {
  it("defaults to six college periods", () => {
    const slots = defaultPeriodSlots();
    expect(slots).toHaveLength(6);
    expect(slots[0]).toEqual({
      label: "Slot 1",
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(slots[2]?.startTime).toBe("11:15");
  });

  it("normalizes empty lists to defaults", () => {
    expect(normalizePeriodSlots([])).toHaveLength(6);
    expect(normalizePeriodSlots(undefined)).toHaveLength(6);
  });

  it("resolves slotIndex to times", () => {
    const slots = defaultPeriodSlots();
    expect(resolvePeriodSlot(slots, 3)).toEqual({
      label: "Slot 4",
      startTime: "13:00",
      endTime: "14:00",
    });
    expect(resolvePeriodSlot(slots, -1)).toBeNull();
    expect(resolvePeriodSlot(slots, 99)).toBeNull();
  });

  it("timesFromSlotIndex reads settings.periodSlots", () => {
    const settings = { periodSlots: defaultPeriodSlots() };
    expect(timesFromSlotIndex(settings, 0)).toEqual({
      startTime: "09:00",
      endTime: "10:00",
      label: "Slot 1",
    });
    expect(timesFromSlotIndex(settings, 5)?.label).toBe("Slot 6");
  });

  it("rejects invalid draft rows", () => {
    expect(
      validatePeriodSlots([
        { label: "A", startTime: "10:00", endTime: "09:00" },
      ]),
    ).toMatch(/after start/i);
    expect(validatePeriodSlots([])).toMatch(/at least one/i);
  });

  it("matchPeriodSlotIndex prefers exact times and never defaults to Slot 1", () => {
    const slots = defaultPeriodSlots();
    expect(matchPeriodSlotIndex(slots, "13:00", "14:00")).toBe(3);
    expect(matchPeriodSlotIndex(slots, "09:00", "09:50")).toBe(0);
    // Real class times that are not in defaults must not select Slot 1
    expect(matchPeriodSlotIndex(slots, "10:30", "11:20")).toBeNull();
    expect(matchPeriodSlotIndex(slots, "16:20", "17:10")).toBeNull();
  });

  it("ensurePeriodSlotsCover replaces stock defaults with real class times", () => {
    const { slots, changed } = ensurePeriodSlotsCover(defaultPeriodSlots(), [
      { startTime: "10:30", endTime: "11:20" },
      { startTime: "16:20", endTime: "17:10" },
    ]);
    expect(changed).toBe(true);
    expect(matchPeriodSlotIndex(slots, "10:30", "11:20")).toBe(0);
    expect(matchPeriodSlotIndex(slots, "16:20", "17:10")).toBe(1);
    expect(slots.some((s) => s.startTime === "09:00")).toBe(false);
  });

  it("ensurePeriodSlotsCover renumbers uniquely after inserting a mid-day period", () => {
    const current = [
      { label: "Slot 1", startTime: "09:20", endTime: "10:20" },
      { label: "Slot 2", startTime: "10:30", endTime: "11:30" },
      { label: "Slot 3", startTime: "11:40", endTime: "12:40" },
      { label: "Slot 4", startTime: "14:00", endTime: "15:00" },
      { label: "Slot 5", startTime: "15:10", endTime: "16:10" },
      { label: "Slot 6", startTime: "16:20", endTime: "17:20" },
    ];
    const { slots, changed } = ensurePeriodSlotsCover(current, [
      { startTime: "13:00", endTime: "14:00" },
    ]);
    expect(changed).toBe(true);
    expect(slots.map((s) => s.label)).toEqual([
      "Slot 1",
      "Slot 2",
      "Slot 3",
      "Slot 4",
      "Slot 5",
      "Slot 6",
      "Slot 7",
    ]);
    expect(slots.map((s) => `${s.startTime}-${s.endTime}`)).toEqual([
      "09:20-10:20",
      "10:30-11:30",
      "11:40-12:40",
      "13:00-14:00",
      "14:00-15:00",
      "15:10-16:10",
      "16:20-17:20",
    ]);
    const labels = new Set(slots.map((s) => s.label));
    expect(labels.size).toBe(slots.length);
  });

  it("ensurePeriodSlotsCover fixes already-duplicated Slot labels", () => {
    const broken = [
      { label: "Slot 1", startTime: "09:20", endTime: "10:20" },
      { label: "Slot 4", startTime: "13:00", endTime: "14:00" },
      { label: "Slot 4", startTime: "14:00", endTime: "15:00" },
    ];
    const { slots, changed } = ensurePeriodSlotsCover(broken, [
      { startTime: "13:00", endTime: "14:00" },
    ]);
    expect(changed).toBe(true);
    expect(slots.map((s) => s.label)).toEqual(["Slot 1", "Slot 2", "Slot 3"]);
  });
});
