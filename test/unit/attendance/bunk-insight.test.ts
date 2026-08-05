import { describe, expect, it } from "vitest";
import {
  calculateSubjectStanding,
  formatBunkInsight,
} from "@/lib/attendance";

describe("formatBunkInsight", () => {
  it("at 100% with Rem shows how many can still bunk", () => {
    const standing = calculateSubjectStanding(
      1,
      1,
      { collegeTargetPct: 75, bufferPct: 0 },
      20,
    );
    const line = formatBunkInsight(standing);
    expect(line).toMatch(/100%/);
    expect(line).toMatch(/can bunk 5 more/);
    expect(line).toMatch(/of 20 left/);
  });

  it("below target shows attend N of next Rem to recover", () => {
    const standing = calculateSubjectStanding(
      14,
      20,
      { collegeTargetPct: 75, bufferPct: 0 },
      12,
    );
    const line = formatBunkInsight(standing);
    expect(line).toMatch(/Attend \d+ of next 12 to recover/);
  });

  it("with no remaining sessions shows timetable / semester hint", () => {
    const standing = calculateSubjectStanding(
      10,
      10,
      { collegeTargetPct: 75, bufferPct: 0 },
      0,
    );
    expect(formatBunkInsight(standing)).toBe(
      "Add timetable / check semester end dates to unlock bunk forecast",
    );
  });

  it("updates the line after marks change", () => {
    const before = formatBunkInsight(
      calculateSubjectStanding(1, 1, { collegeTargetPct: 75, bufferPct: 0 }, 20),
    );
    const after = formatBunkInsight(
      calculateSubjectStanding(1, 2, { collegeTargetPct: 75, bufferPct: 0 }, 19),
    );
    expect(before).not.toBe(after);
    expect(after).toMatch(/Attend/);
  });
});
