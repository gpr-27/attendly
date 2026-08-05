import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addSeries,
  addSubject,
  clearAllData,
  listSessions,
  saveSettings,
} from "@/lib/db";
import { materializeSessions } from "@/lib/timetable";
import { addExtraSession } from "@/lib/timetable/materialize-sessions";

describe("materialize weekParity + makeup", () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it("only materializes odd ISO weeks when weekParity=odd", async () => {
    await saveSettings({
      semesterName: "Parity",
      semesterStart: "2026-01-01",
      semesterEnd: "2026-01-12",
      workingDays: [1, 2, 3, 4, 5],
      onboarded: true,
    });

    const subject = await addSubject({
      name: "Lab",
      shortCode: "LAB",
      color: "#059669",
    });

    // Mondays: Jan 5 (ISO week 2 even), Jan 12 (ISO week 3 odd)
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "lab",
      weekParity: "odd",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    const result = await materializeSessions({
      from: "2026-01-01",
      to: "2026-01-12",
    });
    expect(result.upserted).toBe(1);
    const sessions = await listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.occurrenceKey.endsWith("#2026-01-12")).toBe(true);
  });

  it("links makeup via replacesSessionId + relevance", async () => {
    const subject = await addSubject({
      name: "OS",
      shortCode: "OS",
      color: "#2563eb",
    });
    const cancelledId = crypto.randomUUID();
    const makeup = await addExtraSession({
      subjectId: subject.id,
      date: "2026-08-06",
      startTime: "14:00",
      endTime: "15:00",
      replacesSessionId: cancelledId,
      relevance: "makeup",
    });
    expect(makeup.relevance).toBe("makeup");
    expect(makeup.replacesSessionId).toBe(cancelledId);
    expect(makeup.source).toBe("one_off");
  });
});
