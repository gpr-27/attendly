import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addSeries,
  addSubject,
  clearAllData,
  saveSettings,
} from "@/lib/db";
import { buildAttendanceReport } from "@/lib/analytics/attendance-report";
import { renderReportHtml } from "@/lib/analytics/attendance-report-html";

describe("attendance report", () => {
  beforeEach(async () => {
    await clearAllData();
    await saveSettings({
      semesterName: "Spring 2026",
      semesterStart: "2026-01-01",
      semesterEnd: "2026-05-31",
      targetPct: 75,
      bufferPct: 2,
    });
  });

  afterEach(async () => {
    await clearAllData();
  });

  it("builds report from Dexie subjects + weekly series with no invented %", async () => {
    const sub = await addSubject({
      name: "Data Structures",
      shortCode: "DSA",
      color: "#336699",
    });
    await addSeries({
      subjectId: sub.id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "lecture",
      countsTowardAttendance: true,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    });

    const report = await buildAttendanceReport();
    expect(report.semesterName).toBe("Spring 2026");
    expect(report.targetPct).toBe(75);
    expect(report.subjects).toHaveLength(1);
    expect(report.subjects[0]?.shortCode).toBe("DSA");
    expect(report.subjects[0]?.pct).toBeNull();
    expect(report.subjects[0]?.total).toBe(0);
    expect(report.weeklyPattern.some((d) => d.dayName === "Monday")).toBe(true);
    expect(report.overall.pct).toBeNull();

    const html = renderReportHtml(report);
    expect(html).toContain("Spring 2026");
    expect(html).toContain("DSA");
    expect(html).toContain("Weekly class pattern");
    expect(html).toContain("Overall standing");
  });
});
