import { describe, expect, it } from "vitest";
import {
  countRemainingClasses,
  projectSemesterEnd,
  resolveCollegeTargetPct,
  safeWeekImpact,
  sessionsInDateRange,
  teachingSuppressedOn,
} from "@/lib/attendance";

describe("resolveCollegeTargetPct", () => {
  it("falls back to settings", () => {
    expect(
      resolveCollegeTargetPct({ settingsTargetPct: 75 }),
    ).toBe(75);
  });

  it("uses subject overall before settings", () => {
    expect(
      resolveCollegeTargetPct({
        settingsTargetPct: 75,
        subjectTargetPct: 80,
      }),
    ).toBe(80);
  });

  it("uses component target for lab/tutorial/theory", () => {
    expect(
      resolveCollegeTargetPct({
        settingsTargetPct: 75,
        subjectTargetPct: 80,
        componentTargets: { lab: 90, theory: 75 },
        sessionType: "lab",
      }),
    ).toBe(90);
    expect(
      resolveCollegeTargetPct({
        settingsTargetPct: 75,
        componentTargets: { theory: 78 },
        sessionType: "lecture",
      }),
    ).toBe(78);
  });

  it("series targetPct wins over component", () => {
    expect(
      resolveCollegeTargetPct({
        settingsTargetPct: 75,
        componentTargets: { lab: 90 },
        sessionType: "lab",
        seriesTargetPct: 85,
      }),
    ).toBe(85);
  });
});

describe("teachingSuppressedOn / remaining with blackouts", () => {
  const blocks = [
    {
      startsOn: "2026-10-12",
      endsOn: "2026-10-16",
      suppressesTeaching: true,
    },
  ];

  it("detects exam-week blackout dates", () => {
    expect(teachingSuppressedOn("2026-10-14", blocks)).toBe(true);
    expect(teachingSuppressedOn("2026-10-10", blocks)).toBe(false);
  });

  it("excludes suppressed days from remaining count", () => {
    const localSessions = [
      {
        subjectId: "s1",
        startsAt: new Date(2026, 9, 10, 9, 0).toISOString(),
        status: "scheduled",
        countsTowardAttendance: true,
      },
      {
        subjectId: "s1",
        startsAt: new Date(2026, 9, 14, 9, 0).toISOString(),
        status: "scheduled",
        countsTowardAttendance: true,
      },
      {
        subjectId: "s1",
        startsAt: new Date(2026, 9, 20, 9, 0).toISOString(),
        status: "scheduled",
        countsTowardAttendance: true,
      },
    ];

    const remaining = countRemainingClasses({
      sessions: localSessions,
      asOfYmd: "2026-10-01",
      semesterEnd: "2026-10-31",
      subjectId: "s1",
      calendarBlocks: blocks,
    });
    // Oct 10 + Oct 20; Oct 14 is exam blackout
    expect(remaining).toBe(2);
  });
});

describe("projectSemesterEnd", () => {
  it("projects attend-all and skip-all percentages", () => {
    // 15/20 = 75%, 4 remaining
    // safeToSkip: floor(15+4 - 0.75*24) = floor(19-18) = 1
    const proj = projectSemesterEnd({
      attended: 15,
      total: 20,
      remainingClasses: 4,
      settings: { collegeTargetPct: 75, bufferPct: 0 },
    });
    expect(proj.ifAttendAllPct).toBeCloseTo((15 + 4) / 24 * 100, 5);
    expect(proj.ifSkipAllPct).toBeCloseTo(15 / 24 * 100, 5);
    expect(proj.safeToSkip).toBe(1);
    expect(proj.riskIfSkipAll).toBe("Critical");
  });

  it("reports mustAttend when below target", () => {
    const proj = projectSemesterEnd({
      attended: 14,
      total: 20,
      remainingClasses: 10,
      settings: { collegeTargetPct: 75, bufferPct: 2 },
    });
    expect(proj.mustAttend).not.toBeNull();
    expect(proj.mustAttend).toBeGreaterThan(0);
  });
});

describe("safeWeekImpact", () => {
  it("shows per-subject drop if range classes are missed", () => {
    const sessions = [
      {
        subjectId: "dsa",
        startsAt: new Date(2026, 10, 10, 9, 0).toISOString(),
        status: "scheduled",
        countsTowardAttendance: true,
      },
      {
        subjectId: "dsa",
        startsAt: new Date(2026, 10, 11, 9, 0).toISOString(),
        status: "scheduled",
        countsTowardAttendance: true,
      },
      {
        subjectId: "os",
        startsAt: new Date(2026, 10, 10, 11, 0).toISOString(),
        status: "scheduled",
        countsTowardAttendance: true,
      },
    ];

    const inRange = sessionsInDateRange(
      sessions,
      "2026-11-10",
      "2026-11-14",
    );
    expect(inRange).toHaveLength(3);

    const impact = safeWeekImpact({
      subjects: [
        {
          id: "dsa",
          shortCode: "DSA",
          name: "Algorithms",
          color: "#111",
          attended: 18,
          total: 20,
          collegeTargetPct: 75,
        },
        {
          id: "os",
          shortCode: "OS",
          name: "Operating Systems",
          color: "#222",
          attended: 15,
          total: 20,
          collegeTargetPct: 75,
        },
      ],
      sessionsInRange: inRange,
      bufferPct: 0,
    });

    expect(impact).toHaveLength(2);
    const dsa = impact.find((r) => r.subjectId === "dsa")!;
    expect(dsa.missedClasses).toBe(2);
    expect(dsa.afterMissPct).toBeCloseTo(18 / 22 * 100, 5);
    expect(dsa.currentPct).toBe(90);

    const os = impact.find((r) => r.subjectId === "os")!;
    expect(os.missedClasses).toBe(1);
    expect(os.afterMissPct).toBeCloseTo(15 / 21 * 100, 5);
  });

  it("ignores cancelled and blackout days", () => {
    const sessions = [
      {
        subjectId: "dsa",
        startsAt: new Date(2026, 10, 10, 9, 0).toISOString(),
        status: "cancelled",
        countsTowardAttendance: false,
      },
      {
        subjectId: "dsa",
        startsAt: new Date(2026, 10, 12, 9, 0).toISOString(),
        status: "scheduled",
        countsTowardAttendance: true,
      },
    ];
    const inRange = sessionsInDateRange(
      sessions,
      "2026-11-10",
      "2026-11-14",
      [
        {
          startsOn: "2026-11-12",
          endsOn: "2026-11-12",
          suppressesTeaching: true,
        },
      ],
    );
    expect(inRange).toHaveLength(0);
  });
});
