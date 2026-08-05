import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addSeries,
  addSubject,
  clearAllData,
  deleteSubject,
  getAttendanceForSession,
  listAttendance,
  listExceptions,
  listSeries,
  listSessions,
  listSubjects,
  markAttendance,
  saveSettings,
  upsertException,
} from "@/lib/db";
import { addExtraSession } from "@/lib/timetable/materialize-sessions";
import { materializeSessions } from "@/lib/timetable";

describe("deleteSubject cascade", () => {
  beforeEach(async () => {
    await clearAllData();
    await saveSettings({
      semesterStart: "2026-08-03",
      semesterEnd: "2026-08-07",
      workingDays: [1, 2, 3, 4, 5],
      onboarded: true,
    });
  });

  afterEach(async () => {
    await clearAllData();
  });

  it("removes subject, series, exceptions, sessions, and marks", async () => {
    const keep = await addSubject({
      name: "Keep Me",
      shortCode: "KEEP",
      color: "#16a34a",
    });
    const doomed = await addSubject({
      name: "Algorithms",
      shortCode: "ALG",
      color: "#2563eb",
    });

    await addSeries({
      subjectId: keep.id,
      dayOfWeek: 2,
      startTime: "10:00",
      endTime: "11:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });

    const series = await addSeries({
      subjectId: doomed.id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      effectiveTo: null,
      countsTowardAttendance: true,
    });
    await upsertException({
      seriesId: series.id,
      date: "2026-08-03",
      type: "cancelled",
      reason: "test",
    });

    await materializeSessions({ from: "2026-08-03", to: "2026-08-07" });
    const doomedSessions = (await listSessions()).filter(
      (s) => String(s.subjectId) === String(doomed.id),
    );
    expect(doomedSessions.length).toBeGreaterThan(0);
    await markAttendance(doomedSessions[0]!.id, "present");

    await addExtraSession({
      subjectId: doomed.id,
      date: "2026-08-04",
      startTime: "14:00",
      endTime: "15:00",
    });

    await deleteSubject(doomed.id);

    expect(await listSubjects()).toEqual([
      expect.objectContaining({ id: keep.id, shortCode: "KEEP" }),
    ]);
    expect(await listSeries()).toEqual([
      expect.objectContaining({ subjectId: keep.id }),
    ]);
    expect(await listExceptions()).toEqual([]);
    expect(
      (await listSessions()).every(
        (s) => String(s.subjectId) !== String(doomed.id),
      ),
    ).toBe(true);
    expect(await listAttendance()).toEqual([]);
    expect(await getAttendanceForSession(doomedSessions[0]!.id)).toBeUndefined();
  });
});
