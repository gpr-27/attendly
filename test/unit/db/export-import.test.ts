import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addSeries,
  addSubject,
  clearAllData,
  exportBackup,
  exportBackupJson,
  importBackup,
  importBackupJson,
  listAttendance,
  listSessions,
  listSubjects,
  markAttendance,
  parseBackupJson,
  saveSettings,
} from "@/lib/db";
import { materializeSessions } from "@/lib/timetable";

describe("schedule backup round-trip (no marks)", () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it("exports structure and restores without attendance marks", async () => {
    await saveSettings({
      semesterName: "Backup Term",
      semesterStart: "2026-08-03",
      semesterEnd: "2026-08-07",
      targetPct: 80,
      bufferPct: 3,
      workingDays: [1, 2, 3, 4, 5],
      onboarded: true,
    });

    const subject = await addSubject({
      name: "Algorithms",
      shortCode: "ALG",
      color: "#0f766e",
    });

    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      location: "A101",
      sessionType: "lecture",
      effectiveFrom: "2026-08-03",
      countsTowardAttendance: true,
    });

    await materializeSessions({ from: "2026-08-03", to: "2026-08-07" });
    const sessions = await listSessions();
    expect(sessions.length).toBeGreaterThan(0);
    await markAttendance(sessions[0]!.id, "present");
    expect(await listAttendance()).toHaveLength(1);

    const backup = await exportBackup();
    expect(backup.version).toBe(2);
    expect(backup.scope).toBe("schedule");
    expect(backup.subjects).toHaveLength(1);
    expect(backup.timetableSeries).toHaveLength(1);
    expect(backup.attendanceRecords).toHaveLength(0);
    expect(backup.settings?.targetPct).toBe(80);

    const json = await exportBackupJson();
    await clearAllData();
    expect(await listSubjects()).toHaveLength(0);
    expect(await listAttendance()).toHaveLength(0);

    await importBackupJson(json);
    expect(await listSubjects()).toHaveLength(1);
    expect((await listSubjects())[0]!.shortCode).toBe("ALG");
    expect(await listAttendance()).toHaveLength(0);
    // Rematerialize fills sessions from series for the semester range.
    expect((await listSessions()).length).toBeGreaterThan(0);
  });

  it("rejects wrong files and accepts v1 dumps without restoring marks", async () => {
    expect(() => parseBackupJson("not-json")).toThrow(/valid JSON/i);
    expect(() => parseBackupJson(JSON.stringify({ hello: "world" }))).toThrow(
      /version/i,
    );
    expect(() =>
      parseBackupJson(JSON.stringify({ version: 99, subjects: [] })),
    ).toThrow(/Unsupported backup version/i);

    await saveSettings({
      semesterName: "Old",
      semesterStart: "2026-08-03",
      semesterEnd: "2026-08-07",
      onboarded: true,
    });
    const subject = await addSubject({
      name: "Legacy",
      shortCode: "LEG",
      color: "#334155",
    });

    const current = await exportBackup();
    // Simulate an old v1 full dump that included marks.
    const v1Dump = {
      ...current,
      version: 1,
      scope: undefined,
      subjects: [{ ...subject }],
      attendanceRecords: [
        {
          id: "fake-mark",
          sessionId: "missing",
          status: "present",
          markedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    await clearAllData();
    await importBackup(parseBackupJson(JSON.stringify(v1Dump)), {
      rematerialize: false,
    });
    expect(await listSubjects()).toHaveLength(1);
    expect(await listAttendance()).toHaveLength(0);
  });
});
