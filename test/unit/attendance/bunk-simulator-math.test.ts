import { describe, expect, it } from "vitest";
import {
  buildSkipAttendLadder,
  buildSubjectBunkOutlook,
  simulateBunkScenario,
  skipsUntilRiskBand,
} from "@/lib/attendance";

describe("simulateBunkScenario", () => {
  it("applies extra skips to A/T and remaining", () => {
    const result = simulateBunkScenario({
      attended: 18,
      total: 20,
      remainingClasses: 10,
      settings: { collegeTargetPct: 75, bufferPct: 2 },
      extraSkips: 2,
    });
    expect(result.attended).toBe(18);
    expect(result.total).toBe(22);
    expect(result.remainingAfterScenario).toBe(8);
    expect(result.percentage).toBeCloseTo(81.82, 1);
    expect(result.risk).toBe("Safe");
  });

  it("applies recovery attends", () => {
    const result = simulateBunkScenario({
      attended: 14,
      total: 20,
      remainingClasses: 8,
      settings: { collegeTargetPct: 75, bufferPct: 0 },
      extraAttends: 3,
    });
    expect(result.attended).toBe(17);
    expect(result.total).toBe(23);
    expect(result.remainingAfterScenario).toBe(5);
  });
});

describe("buildSkipAttendLadder", () => {
  it("builds cumulative skip vs attend paths", () => {
    const rows = buildSkipAttendLadder({
      attended: 15,
      total: 20,
      settings: { collegeTargetPct: 75, bufferPct: 0 },
      steps: 2,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].skipPct).toBeCloseTo(71.43, 1);
    expect(rows[0].attendPct).toBeCloseTo(76.19, 1);
  });
});

describe("skipsUntilRiskBand", () => {
  it("returns skips until college min", () => {
    expect(
      skipsUntilRiskBand({
        attended: 15,
        total: 20,
        settings: { collegeTargetPct: 75, bufferPct: 2 },
        targetBand: "Critical",
      }),
    ).toBe(1);
  });
});

describe("buildSubjectBunkOutlook", () => {
  it("sorts by canSkipThisTerm descending", () => {
    const rows = buildSubjectBunkOutlook({
      subjects: [
        {
          id: "a",
          name: "A",
          shortCode: "A",
          color: "#000",
          attended: 14,
          total: 20,
          collegeTargetPct: 75,
        },
        {
          id: "b",
          name: "B",
          shortCode: "B",
          color: "#111",
          attended: 18,
          total: 20,
          collegeTargetPct: 75,
        },
      ],
      sessions: [
        {
          subjectId: "a",
          startsAt: "2026-08-10T09:00:00.000Z",
          status: "scheduled",
        },
        {
          subjectId: "b",
          startsAt: "2026-08-10T10:00:00.000Z",
          status: "scheduled",
        },
      ],
      asOfYmd: "2026-08-06",
      bufferPct: 0,
    });
    expect(rows[0].subjectId).toBe("b");
    expect(rows[0].standing.canSkipThisTerm).toBeGreaterThan(
      rows[1].standing.canSkipThisTerm,
    );
  });
});
