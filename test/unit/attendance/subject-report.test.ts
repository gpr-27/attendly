import { describe, expect, it } from "vitest";
import {
  buildSubjectReport,
  resolveSubjectReportStatus,
  subjectReportStatusLabel,
} from "@/lib/attendance/subject-report";
import { calculateSubjectStanding } from "@/lib/attendance";
import type { AttendanceRecord, ClassSession, Subject } from "@/lib/db";

function subject(id = "sub-1"): Subject {
  return {
    id,
    name: "Machine Learning",
    shortCode: "CS402",
    color: "#0d7a5f",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function session(
  partial: Partial<ClassSession> & Pick<ClassSession, "id" | "startsAt" | "endsAt">,
): ClassSession {
  const ymd = partial.startsAt.slice(0, 10);
  return {
    occurrenceKey: `series-1#${ymd}`,
    subjectId: "sub-1",
    sessionType: "lecture",
    source: "series",
    status: "scheduled",
    countsTowardAttendance: true,
    relevance: "scheduled",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("resolveSubjectReportStatus", () => {
  it("cancelled/holiday beat marks", () => {
    expect(resolveSubjectReportStatus("cancelled", "present")).toBe(
      "cancelled",
    );
    expect(resolveSubjectReportStatus("holiday", "absent")).toBe("holiday");
  });

  it("maps marks and unmarked", () => {
    expect(resolveSubjectReportStatus("scheduled", "present")).toBe("present");
    expect(resolveSubjectReportStatus("scheduled", "on_duty")).toBe("on_duty");
    expect(resolveSubjectReportStatus("scheduled", undefined)).toBe(
      "not_marked",
    );
  });
});

describe("buildSubjectReport", () => {
  it("groups sessions by week with weekday + status", () => {
    const sessions: ClassSession[] = [
      session({
        id: "s1",
        startsAt: "2026-08-03T04:00:00.000Z", // Mon local depends on TZ — use noon local via Date
        endsAt: "2026-08-03T05:00:00.000Z",
        location: "Lab 2",
        occurrenceKey: "series-1#2026-08-03",
      }),
      session({
        id: "s2",
        startsAt: "2026-08-05T04:00:00.000Z",
        endsAt: "2026-08-05T05:00:00.000Z",
        occurrenceKey: "series-1#2026-08-05",
        status: "cancelled",
      }),
      session({
        id: "s3",
        startsAt: "2026-08-10T04:00:00.000Z",
        endsAt: "2026-08-10T05:00:00.000Z",
        occurrenceKey: "series-1#2026-08-10",
      }),
    ];

    // Force local dates via occurrenceKey YYYY-MM-DD
    const marks: AttendanceRecord[] = [
      {
        id: "m1",
        sessionId: "s1",
        status: "present",
        markedAt: "2026-08-03T06:00:00.000Z",
      },
    ];

    const standing = calculateSubjectStanding(
      1,
      1,
      { collegeTargetPct: 75, bufferPct: 2 },
      10,
    );

    const report = buildSubjectReport({
      subject: subject(),
      sessions,
      marks,
      standing,
      semesterStart: "2026-07-27",
      semesterEnd: "2026-12-15",
      asOfYmd: "2026-08-05",
    });

    expect(report.name).toBe("Machine Learning");
    expect(report.summary.present).toBe(1);
    expect(report.summary.cancelled).toBe(1);
    expect(report.summary.notMarked).toBe(1);
    expect(report.summary.remaining).toBe(10);
    expect(report.weeks.length).toBe(2);

    const firstWeek = report.weeks[0]!;
    expect(firstWeek.weekStartYmd).toBe("2026-08-03");
    expect(firstWeek.sessions[0]!.weekday).toBe("Monday");
    expect(firstWeek.sessions[0]!.status).toBe("present");
    expect(firstWeek.sessions[0]!.room).toBe("Lab 2");
    expect(firstWeek.sessions[1]!.status).toBe("cancelled");
    expect(subjectReportStatusLabel("on_duty")).toBe("OD");
    expect(subjectReportStatusLabel("not_marked")).toBe("Not marked");
  });

  it("filters other subjects and outside semester", () => {
    const sessions: ClassSession[] = [
      session({
        id: "other",
        subjectId: "other-sub",
        startsAt: "2026-08-03T04:00:00.000Z",
        endsAt: "2026-08-03T05:00:00.000Z",
        occurrenceKey: "series-x#2026-08-03",
      }),
      session({
        id: "before",
        startsAt: "2026-07-01T04:00:00.000Z",
        endsAt: "2026-07-01T05:00:00.000Z",
        occurrenceKey: "series-1#2026-07-01",
      }),
      session({
        id: "ok",
        startsAt: "2026-08-04T04:00:00.000Z",
        endsAt: "2026-08-04T05:00:00.000Z",
        occurrenceKey: "series-1#2026-08-04",
      }),
    ];

    const standing = calculateSubjectStanding(0, 0, {
      collegeTargetPct: 75,
      bufferPct: 0,
    }, 5);

    const report = buildSubjectReport({
      subject: subject(),
      sessions,
      marks: [],
      standing,
      semesterStart: "2026-07-27",
      semesterEnd: "2026-12-15",
      asOfYmd: "2026-08-05",
    });

    expect(report.weeks.flatMap((w) => w.sessions)).toHaveLength(1);
    expect(report.weeks[0]!.sessions[0]!.sessionId).toBe("ok");
  });
});
