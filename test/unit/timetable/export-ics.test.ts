import { describe, expect, it } from "vitest";
import { buildSessionsIcs, toIcsUtc } from "@/lib/timetable/export-ics";
import type { ClassSession, Subject } from "@/lib/db";

describe("export-ics", () => {
  it("formats UTC timestamps", () => {
    expect(toIcsUtc("2026-08-03T03:30:00.000Z")).toBe("20260803T033000Z");
  });

  it("builds VCALENDAR with scheduled events only", () => {
    const subjects: Subject[] = [
      {
        id: "s1",
        name: "Algorithms",
        shortCode: "ALG",
        color: "#2563eb",
        createdAt: "",
        updatedAt: "",
      },
    ];
    const sessions: ClassSession[] = [
      {
        id: "c1",
        occurrenceKey: "x#2026-08-03",
        subjectId: "s1",
        startsAt: "2026-08-03T03:30:00.000Z",
        endsAt: "2026-08-03T04:30:00.000Z",
        sessionType: "lecture",
        source: "series",
        status: "scheduled",
        countsTowardAttendance: true,
        relevance: "scheduled",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "c2",
        occurrenceKey: "y#2026-08-03",
        subjectId: "s1",
        startsAt: "2026-08-03T05:30:00.000Z",
        endsAt: "2026-08-03T06:30:00.000Z",
        sessionType: "lecture",
        source: "series",
        status: "cancelled",
        countsTowardAttendance: false,
        relevance: "scheduled",
        createdAt: "",
        updatedAt: "",
      },
    ];

    const ics = buildSessionsIcs({
      sessions,
      subjects,
      calendarName: "Test Term",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:ALG — Algorithms");
    expect(ics).toContain("UID:c1@attendly");
    expect(ics).not.toContain("UID:c2@attendly");
  });
});
