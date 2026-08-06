// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addSeries,
  addSubject,
  clearAllData,
  listAttendance,
  markAttendance,
  saveSettings,
} from "@/lib/db";
import {
  readLocalSnapshot,
  syncAfterBind,
  flushCloudPush,
  pullCloudToLocal,
  resetCloudSyncState,
  setCloudSyncEnabled,
} from "@/lib/db/cloud-sync";
import {
  localHasUnsyncedAttendance,
  mergeSnapshots,
} from "@/lib/supabase/merge-snapshot";
import { emptySnapshot } from "@/lib/supabase/snapshot";
import { materializeSessions } from "@/lib/timetable";
import {
  defaultSettings,
  type AttendanceRecord,
  type ClassSession,
  type Settings,
} from "@/lib/db/types";
import { restoreTestFetch } from "../../setup";

function sessionRow(id: string, occurrenceKey: string): ClassSession {
  const stamp = "2026-08-04T09:00:00.000Z";
  return {
    id,
    occurrenceKey,
    subjectId: "sub-1",
    seriesId: "series-1",
    originalStart: stamp,
    startsAt: stamp,
    endsAt: "2026-08-04T10:00:00.000Z",
    location: undefined,
    sessionType: "lecture",
    source: "series",
    status: "scheduled",
    countsTowardAttendance: true,
    relevance: "scheduled",
    replacesSessionId: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function markRow(sessionId: string, markedAt: string): AttendanceRecord {
  return {
    id: `mark-${sessionId}`,
    sessionId,
    status: "present",
    markedAt,
  };
}

describe("mergeSnapshots", () => {
  it("keeps local past-day marks when cloud snapshot lacks them", () => {
    const remote = emptySnapshot();
    remote.subjects = [
      {
        id: "sub-1",
        name: "Algorithms",
        shortCode: "ALG",
        color: "#000",
        archived: false,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ];

    const localSession = sessionRow("local-session", "series-1#2026-08-04");
    const local = {
      ...remote,
      classSessions: [localSession],
      attendanceRecords: [markRow("local-session", "2026-08-04T10:05:00.000Z")],
    };

    const merged = mergeSnapshots(remote, local);
    expect(merged.attendanceRecords).toHaveLength(1);
    expect(merged.attendanceRecords[0]?.sessionId).toBe("local-session");
    expect(merged.classSessions.some((s) => s.id === "local-session")).toBe(true);
  });

  it("prefers newer local markedAt over stale cloud row", () => {
    const remote = emptySnapshot();
    remote.attendanceRecords = [
      markRow("s1", "2026-08-04T09:00:00.000Z"),
    ];
    const local = emptySnapshot();
    local.attendanceRecords = [
      { ...markRow("s1", "2026-08-04T11:00:00.000Z"), status: "absent" },
    ];

    const merged = mergeSnapshots(remote, local);
    expect(merged.attendanceRecords[0]?.status).toBe("absent");
    expect(merged.attendanceRecords[0]?.markedAt).toBe(
      "2026-08-04T11:00:00.000Z",
    );
  });

  it("prefers cloud settings on equal updatedAt", () => {
    const remote = emptySnapshot();
    const base: Settings = {
      ...defaultSettings(),
      semesterStart: "2026-08-01",
      semesterEnd: "2026-12-01",
      targetPct: 75,
      onboarded: true,
      updatedAt: "2026-08-04T10:00:00.000Z",
    };
    remote.settings = base;
    const local = emptySnapshot();
    local.settings = {
      ...base,
      targetPct: 80,
    };

    const merged = mergeSnapshots(remote, local);
    expect(merged.settings?.targetPct).toBe(75);
  });

  it("detects unsynced local attendance", () => {
    const remote = emptySnapshot();
    const local = emptySnapshot();
    local.attendanceRecords = [markRow("s1", "2026-08-04T10:00:00.000Z")];
    expect(localHasUnsyncedAttendance(local, remote)).toBe(true);
    expect(localHasUnsyncedAttendance(remote, local)).toBe(false);
  });
});

describe("syncAfterBind", () => {
  beforeEach(async () => {
    resetCloudSyncState();
    await clearAllData();
  });

  afterEach(() => {
    resetCloudSyncState();
    restoreTestFetch();
  });

  it("preserves local marks when cloud pull is stale", async () => {
    setCloudSyncEnabled(false);
    await saveSettings({
      semesterStart: "2026-08-04",
      semesterEnd: "2026-08-08",
      workingDays: [1, 2, 3, 4, 5],
      targetPct: 75,
      bufferPct: 0,
      onboarded: true,
    });
    const subject = await addSubject({
      name: "Networks",
      shortCode: "NET",
      color: "#16a34a",
    });
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 2,
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-04",
      countsTowardAttendance: true,
    });
    await materializeSessions({ from: "2026-08-04", to: "2026-08-04" });
    const sessions = (await import("@/lib/db")).listSessions;
    const daySessions = await sessions();
    expect(daySessions.length).toBeGreaterThan(0);
    await markAttendance(daySessions[0]!.id, "present");

    const localBefore = await readLocalSnapshot();
    expect(localBefore.attendanceRecords).toHaveLength(1);

    setCloudSyncEnabled(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.includes("/api/sync")) {
          if ((init?.method ?? "GET").toUpperCase() === "GET") {
            const stale = emptySnapshot();
            stale.settings = localBefore.settings;
            stale.subjects = localBefore.subjects;
            stale.timetableSeries = localBefore.timetableSeries;
            stale.classSessions = localBefore.classSessions;
            return new Response(
              JSON.stringify({ ok: true, hasData: true, snapshot: stale }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const result = await syncAfterBind();
    expect(result).toBe("pulled");
    expect(await listAttendance()).toHaveLength(1);
  });
});

describe("flushCloudPush", () => {
  beforeEach(async () => {
    resetCloudSyncState();
    await clearAllData();
  });

  afterEach(() => {
    resetCloudSyncState();
    restoreTestFetch();
  });

  it("pushes again after waiting for an in-flight push", async () => {
    setCloudSyncEnabled(false);
    await saveSettings({
      semesterStart: "2026-08-04",
      semesterEnd: "2026-08-08",
      workingDays: [1, 2, 3, 4, 5],
      targetPct: 75,
      bufferPct: 0,
      onboarded: true,
    });
    const subject = await addSubject({
      name: "Math",
      shortCode: "MAT",
      color: "#2563eb",
    });
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 2,
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-04",
      countsTowardAttendance: true,
    });
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 2,
      startTime: "11:00",
      endTime: "12:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-04",
      countsTowardAttendance: true,
    });
    await materializeSessions({ from: "2026-08-04", to: "2026-08-04" });
    const { listSessions } = await import("@/lib/db");
    const sessions = (await listSessions()).sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );

    let pushBodies: Array<{ attendanceRecords: AttendanceRecord[] }> = [];
    let releaseFirstPush!: () => void;
    const firstPushGate = new Promise<void>((resolve) => {
      releaseFirstPush = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (!url.includes("/api/sync")) {
          throw new Error(`Unexpected fetch: ${url}`);
        }
        if ((init?.method ?? "GET").toUpperCase() === "PUT") {
          const body = JSON.parse(String(init?.body)) as {
            snapshot: { attendanceRecords: AttendanceRecord[] };
          };
          if (pushBodies.length === 0) {
            await firstPushGate;
          }
          pushBodies.push(body.snapshot);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ ok: true, hasData: false, snapshot: emptySnapshot() }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    setCloudSyncEnabled(true);
    setCloudSyncEnabled(false);
    await markAttendance(sessions[0]!.id, "present");
    setCloudSyncEnabled(true);
    const firstFlush = flushCloudPush();
    await new Promise((r) => setTimeout(r, 5));
    setCloudSyncEnabled(false);
    await markAttendance(sessions[1]!.id, "present");
    setCloudSyncEnabled(true);
    releaseFirstPush();
    await firstFlush;
    await flushCloudPush();

    expect(pushBodies.length).toBe(2);
    expect(pushBodies[0]?.attendanceRecords).toHaveLength(1);
    expect(pushBodies[1]?.attendanceRecords).toHaveLength(2);
  });
});

describe("syncCriticalToCloud", () => {
  beforeEach(async () => {
    resetCloudSyncState();
    await clearAllData();
  });

  afterEach(() => {
    resetCloudSyncState();
    restoreTestFetch();
  });

  it("pushes immediately after markAttendance", async () => {
    setCloudSyncEnabled(false);
    await saveSettings({
      semesterStart: "2026-08-04",
      semesterEnd: "2026-08-08",
      workingDays: [1, 2, 3, 4, 5],
      targetPct: 75,
      bufferPct: 0,
      onboarded: true,
    });
    const subject = await addSubject({
      name: "Physics",
      shortCode: "PHY",
      color: "#dc2626",
    });
    await addSeries({
      subjectId: subject.id,
      dayOfWeek: 2,
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "lecture",
      effectiveFrom: "2026-08-04",
      countsTowardAttendance: true,
    });
    await materializeSessions({ from: "2026-08-04", to: "2026-08-04" });
    setCloudSyncEnabled(true);
    const { listSessions } = await import("@/lib/db");
    const sessions = await listSessions();
    expect(sessions.length).toBeGreaterThan(0);

    let pushCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (!url.includes("/api/sync")) {
          throw new Error(`Unexpected fetch: ${url}`);
        }
        if ((init?.method ?? "GET").toUpperCase() === "PUT") {
          pushCount += 1;
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ ok: true, hasData: false, snapshot: emptySnapshot() }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    await markAttendance(sessions[0]!.id, "present");
    expect(pushCount).toBe(0);
    expect(await listAttendance()).toHaveLength(1);
    await flushCloudPush();
    expect(pushCount).toBe(1);
  });
});

describe("pullCloudToLocal", () => {
  beforeEach(async () => {
    resetCloudSyncState();
    await clearAllData();
  });

  afterEach(() => {
    resetCloudSyncState();
    restoreTestFetch();
  });

  it("hydrates Dexie from cloud snapshot", async () => {
    const cloud = emptySnapshot();
    cloud.settings = {
      ...defaultSettings(),
      semesterStart: "2026-08-01",
      semesterEnd: "2026-12-01",
      targetPct: 85,
      onboarded: true,
      updatedAt: "2026-08-06T00:00:00.000Z",
    };
    cloud.subjects = [
      {
        id: "sub-cloud",
        name: "Cloud Subject",
        shortCode: "CLD",
        color: "#000",
        archived: false,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.includes("/api/sync")) {
          return new Response(
            JSON.stringify({ ok: true, hasData: true, snapshot: cloud }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    await clearAllData();
    const pulled = await pullCloudToLocal();
    expect(pulled).toBe(true);
    const local = await readLocalSnapshot();
    expect(local.settings?.targetPct).toBe(85);
    expect(local.subjects).toHaveLength(1);
    expect(local.subjects[0]?.shortCode).toBe("CLD");
  });
});
