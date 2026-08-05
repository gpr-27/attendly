import { describe, expect, it } from "vitest";
import {
  calculatePercentage,
  calculateSubjectStanding,
  canSkipThisTerm,
  classesToRecover,
  classesYouCanSkip,
  countAttendanceFromMarks,
  effectiveTargetPct,
  impactLine,
  isExcludedSessionStatus,
  markContribution,
  mustAttendThisTerm,
  nextClassImpact,
  riskBand,
  sessionCountsTowardAttendance,
} from "@/lib/attendance";

describe("calculatePercentage", () => {
  it("returns A/T × 100", () => {
    expect(calculatePercentage(15, 20)).toBe(75);
  });

  it("returns null when total is 0", () => {
    expect(calculatePercentage(0, 0)).toBeNull();
  });
});

describe("effectiveTargetPct", () => {
  it("adds buffer to college min", () => {
    expect(effectiveTargetPct(75, 2)).toBe(77);
  });
});

describe("classesYouCanSkip", () => {
  it("is 0 when below target", () => {
    expect(classesYouCanSkip(14, 20, 75)).toBe(0);
  });

  it("counts bunks while staying at 75%", () => {
    // 18/20 = 90%. floor(18/0.75 - 20) = floor(24 - 20) = 4
    expect(classesYouCanSkip(18, 20, 75)).toBe(4);
  });

  it("exact target yields 0 skips", () => {
    expect(classesYouCanSkip(15, 20, 75)).toBe(0);
  });
});

describe("classesToRecover", () => {
  it("matches ceil((pT - A)/(1-p))", () => {
    // 14/20 = 70%, need 75%: ceil((0.75*20 - 14)/0.25) = ceil(1/0.25) = 4
    expect(classesToRecover(14, 20, 75)).toBe(4);
  });

  it("is 0 when already at target", () => {
    expect(classesToRecover(15, 20, 75)).toBe(0);
  });
});

describe("term-bounded skip / must-attend", () => {
  it("canSkipThisTerm clamps to remaining", () => {
    // Unlimited bunks would be 4; only 2 left → 2
    expect(canSkipThisTerm(18, 20, 2, 75)).toBe(2);
  });

  it("canSkipThisTerm uses remaining math", () => {
    // S ≤ 15 + 10 - 0.75*(20+10) = 25 - 22.5 = 2.5 → floor 2
    expect(canSkipThisTerm(15, 20, 10, 75)).toBe(2);
  });

  it("mustAttendThisTerm returns null when not enough classes left", () => {
    expect(mustAttendThisTerm(14, 20, 3, 75)).toBeNull();
  });

  it("mustAttendThisTerm returns need when reachable", () => {
    expect(mustAttendThisTerm(14, 20, 5, 75)).toBe(4);
  });
});

describe("riskBand", () => {
  it("Critical below college min", () => {
    expect(riskBand(74, 75, 2)).toBe("Critical");
  });

  it("Warning between college and buffer", () => {
    expect(riskBand(76, 75, 2)).toBe("Warning");
  });

  it("Safe at or above buffer target", () => {
    expect(riskBand(77, 75, 2)).toBe("Safe");
  });

  it("Safe when no percentage yet", () => {
    expect(riskBand(null, 75, 2)).toBe("Safe");
  });
});

describe("impact line", () => {
  it("computes skip vs attend next class", () => {
    const { skipPercentage, attendPercentage } = nextClassImpact(15, 20);
    expect(skipPercentage).toBeCloseTo(15 / 21 * 100, 5);
    expect(attendPercentage).toBeCloseTo(16 / 21 * 100, 5);
  });

  it("formats the daily hook line", () => {
    const preview = impactLine("DSA", 15, 20);
    expect(preview.line).toBe("Skip DSA → 71.4% · Attend → 76.2%");
  });
});

describe("session counting / OD exclusions", () => {
  it("excludes cancelled and holiday", () => {
    expect(isExcludedSessionStatus("cancelled")).toBe(true);
    expect(isExcludedSessionStatus("holiday")).toBe(true);
    expect(sessionCountsTowardAttendance({ status: "cancelled" })).toBe(false);
    expect(
      sessionCountsTowardAttendance({ countsTowardAttendance: false }),
    ).toBe(false);
    expect(sessionCountsTowardAttendance({ status: "held" })).toBe(true);
  });

  it("default OD/excused exclude from denominator", () => {
    expect(markContribution("on_duty")).toEqual({
      attendedDelta: 0,
      totalDelta: 0,
    });
    expect(markContribution("excused", "exclude")).toEqual({
      attendedDelta: 0,
      totalDelta: 0,
    });
  });

  it("OD can count as present when configured", () => {
    expect(markContribution("on_duty", "present")).toEqual({
      attendedDelta: 1,
      totalDelta: 1,
    });
  });

  it("aggregates marks skipping cancelled", () => {
    const { attended, total } = countAttendanceFromMarks(
      [
        { markStatus: "present", sessionStatus: "held" },
        { markStatus: "absent", sessionStatus: "held" },
        { markStatus: "present", sessionStatus: "cancelled" },
        { markStatus: "on_duty", sessionStatus: "held" },
      ],
      "exclude",
    );
    expect(attended).toBe(1);
    expect(total).toBe(2);
  });
});

describe("calculateSubjectStanding", () => {
  it("wires percentage, bunks, recovery, risk", () => {
    const standing = calculateSubjectStanding(14, 20, {
      collegeTargetPct: 75,
      bufferPct: 2,
    }, 10);

    expect(standing.percentage).toBe(70);
    expect(standing.effectiveTargetPct).toBe(77);
    expect(standing.risk).toBe("Critical");
    expect(standing.classesYouCanSkip).toBe(0);
    expect(standing.classesToRecover).toBeGreaterThan(0);
    expect(standing.mustAttendThisTerm).not.toBeNull();
    expect(standing.remainingClasses).toBe(10);
  });

  it("at 100% with Rem=20 and target 75%, term bunks > 0 (infinite horizon may be 0)", () => {
    // Early in term: 1/1 = 100%. Infinite skip = floor(1/0.75 − 1) = 0,
    // but term-bounded with 20 left is positive.
    const standing = calculateSubjectStanding(
      1,
      1,
      { collegeTargetPct: 75, bufferPct: 0 },
      20,
    );
    expect(standing.percentage).toBe(100);
    expect(standing.classesYouCanSkip).toBe(0);
    expect(standing.canSkipThisTerm).toBeGreaterThan(0);
    expect(standing.canSkipThisTerm).toBe(5);
    expect(standing.remainingClasses).toBe(20);
  });

  it("recalculates term bunks after an absence", () => {
    const before = calculateSubjectStanding(
      5,
      5,
      { collegeTargetPct: 75, bufferPct: 0 },
      20,
    );
    // Mark one future class absent → A stays 5, T becomes 6, Rem 19
    const after = calculateSubjectStanding(
      5,
      6,
      { collegeTargetPct: 75, bufferPct: 0 },
      19,
    );
    expect(before.canSkipThisTerm).toBeGreaterThan(after.canSkipThisTerm);
    expect(after.percentage).toBeCloseTo((5 / 6) * 100, 5);
  });
});
