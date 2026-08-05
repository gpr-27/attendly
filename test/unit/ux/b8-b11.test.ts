import { describe, expect, it } from "vitest";
import {
  buildPatternCards,
  computeStreaks,
  computeWeekdayInsights,
} from "@/lib/analytics/patterns";
import type { AttendanceRecord, ClassSession } from "@/lib/db/types";
import {
  slotPreviewMeta,
  subjectPreviewMeta,
} from "@/lib/import/preview-confidence";

function session(
  partial: Partial<ClassSession> & Pick<ClassSession, "id" | "startsAt">,
): ClassSession {
  return {
    occurrenceKey: partial.id,
    subjectId: "sub-1",
    endsAt: partial.startsAt,
    sessionType: "lecture",
    source: "series",
    status: "scheduled",
    countsTowardAttendance: true,
    relevance: "scheduled",
    createdAt: partial.startsAt,
    updatedAt: partial.startsAt,
    ...partial,
  };
}

function mark(
  sessionId: string,
  status: AttendanceRecord["status"],
): AttendanceRecord {
  return {
    id: `m-${sessionId}`,
    sessionId,
    status,
    markedAt: new Date().toISOString(),
  };
}

describe("analytics patterns", () => {
  it("returns empty streaks with no marks", () => {
    const streaks = computeStreaks([], []);
    expect(streaks.daysWithMarks).toBe(0);
    expect(streaks.currentPresentStreak).toBe(0);
  });

  it("flags a Monday absence pattern from real marks", () => {
    const sessions: ClassSession[] = [];
    const marks: AttendanceRecord[] = [];

    // Several Mondays absent (local noon so getDay is stable)
    for (let i = 0; i < 4; i++) {
      const id = `mon-${i}`;
      const day = 5 + i * 7; // Jan 5 2026 is Monday
      const starts = new Date(2026, 0, day, 12, 0, 0).toISOString();
      sessions.push(session({ id, startsAt: starts }));
      marks.push(mark(id, "absent"));
    }
    // Tuesdays mostly present
    for (let i = 0; i < 4; i++) {
      const id = `tue-${i}`;
      const day = 6 + i * 7;
      const starts = new Date(2026, 0, day, 12, 0, 0).toISOString();
      sessions.push(session({ id, startsAt: starts }));
      marks.push(mark(id, "present"));
    }

    const insights = computeWeekdayInsights(sessions, marks);
    const monday = insights.find((d) => d.dayOfWeek === 1);
    expect(monday?.absences).toBe(4);

    const cards = buildPatternCards(insights);
    expect(cards.some((c) => c.id === "miss-1")).toBe(true);
  });
});

describe("preview confidence", () => {
  it("marks missing subject name", () => {
    const meta = subjectPreviewMeta({ name: "", shortCode: "DSA" });
    expect(meta.highlights.some((h) => h.field === "name" && h.level === "missing")).toBe(
      true,
    );
  });

  it("flags unknown slot codes", () => {
    const meta = slotPreviewMeta(
      {
        subjectShortCode: "ZZZ",
        dayOfWeek: 1,
        start: "09:00",
        end: "10:00",
      },
      new Set(["DSA"]),
    );
    expect(
      meta.highlights.some(
        (h) => h.field === "subjectShortCode" && h.level === "low",
      ),
    ).toBe(true);
  });
});
