import { describe, expect, it } from "vitest";
import { isoWeekNumber, matchesWeekParity } from "@/lib/timetable/week-parity";

describe("isoWeekNumber / matchesWeekParity", () => {
  it("computes known ISO week numbers", () => {
    // 2026-01-05 is Monday of ISO week 2
    expect(isoWeekNumber("2026-01-05")).toBe(2);
    // 2026-01-01 is Thursday of ISO week 1
    expect(isoWeekNumber("2026-01-01")).toBe(1);
  });

  it("treats missing/all as every week", () => {
    expect(matchesWeekParity("2026-01-05", undefined)).toBe(true);
    expect(matchesWeekParity("2026-01-05", "all")).toBe(true);
  });

  it("filters odd vs even ISO weeks", () => {
    // week 1 → odd
    expect(matchesWeekParity("2026-01-01", "odd")).toBe(true);
    expect(matchesWeekParity("2026-01-01", "even")).toBe(false);
    // week 2 → even
    expect(matchesWeekParity("2026-01-05", "odd")).toBe(false);
    expect(matchesWeekParity("2026-01-05", "even")).toBe(true);
  });
});
