/**
 * Client-side cloud sync helpers.
 * Dexie remains the offline cache; Supabase (via /api/sync) is source of truth when online.
 */
import { db, getBoundUserId } from "./database";
import type {
  AttendanceRecord,
  CalendarBlock,
  ClassSession,
  SeriesException,
  Settings,
  Subject,
  TimetableSeries,
} from "./types";
import {
  emptySnapshot,
  snapshotHasData,
  type CloudSnapshot,
} from "@/lib/supabase/snapshot";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight: Promise<void> | null = null;
let syncEnabled = true;

export function setCloudSyncEnabled(enabled: boolean) {
  syncEnabled = enabled;
}

function allTables() {
  return [
    db.settings,
    db.subjects,
    db.timetableSeries,
    db.seriesExceptions,
    db.calendarBlocks,
    db.classSessions,
    db.attendanceRecords,
  ] as const;
}

export async function readLocalSnapshot(): Promise<CloudSnapshot> {
  const [
    settingsRows,
    subjects,
    timetableSeries,
    seriesExceptions,
    calendarBlocks,
    classSessions,
    attendanceRecords,
  ] = await Promise.all([
    db.settings.toArray(),
    db.subjects.toArray(),
    db.timetableSeries.toArray(),
    db.seriesExceptions.toArray(),
    db.calendarBlocks.toArray(),
    db.classSessions.toArray(),
    db.attendanceRecords.toArray(),
  ]);

  return {
    settings: (settingsRows[0] as Settings | undefined) ?? null,
    subjects: subjects as Subject[],
    timetableSeries: timetableSeries as TimetableSeries[],
    seriesExceptions: seriesExceptions as SeriesException[],
    calendarBlocks: calendarBlocks as CalendarBlock[],
    classSessions: classSessions as ClassSession[],
    attendanceRecords: attendanceRecords as AttendanceRecord[],
  };
}

export async function writeLocalSnapshot(snap: CloudSnapshot): Promise<void> {
  const tables = allTables();
  await db.transaction("rw", [...tables], async () => {
    await Promise.all(tables.map((t) => t.clear()));
    if (snap.settings) await db.settings.put(snap.settings);
    if (snap.subjects.length) await db.subjects.bulkPut(snap.subjects);
    if (snap.timetableSeries.length) {
      await db.timetableSeries.bulkPut(snap.timetableSeries);
    }
    if (snap.seriesExceptions.length) {
      await db.seriesExceptions.bulkPut(snap.seriesExceptions);
    }
    if (snap.calendarBlocks.length) {
      await db.calendarBlocks.bulkPut(snap.calendarBlocks);
    }
    if (snap.classSessions.length) {
      await db.classSessions.bulkPut(snap.classSessions);
    }
    if (snap.attendanceRecords.length) {
      await db.attendanceRecords.bulkPut(snap.attendanceRecords);
    }
  });
}

async function fetchPull(): Promise<{
  hasData: boolean;
  snapshot: CloudSnapshot;
} | null> {
  try {
    const res = await fetch("/api/sync", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (res.status === 503) return null; // not configured
    if (!res.ok) {
      console.warn("[cloud-sync] pull failed", res.status);
      return null;
    }
    const data = (await res.json()) as {
      hasData?: boolean;
      snapshot?: CloudSnapshot;
    };
    return {
      hasData: Boolean(data.hasData),
      snapshot: data.snapshot ?? emptySnapshot(),
    };
  } catch (err) {
    console.warn("[cloud-sync] pull error", err);
    return null;
  }
}

export class CloudSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudSyncError";
  }
}

/**
 * Push the bound Dexie snapshot to Supabase.
 * Soft mode (default): returns false on failure (background sync).
 * Hard mode: throws CloudSyncError — used by schedule import.
 */
export async function pushLocalToCloud(
  options?: { required?: boolean },
): Promise<boolean> {
  const required = options?.required ?? false;
  if (!getBoundUserId()) {
    if (required) {
      throw new CloudSyncError(
        "Sign in first — cloud sync needs your Clerk account.",
      );
    }
    return false;
  }
  if (!syncEnabled && !required) return false;

  const snapshot = await readLocalSnapshot();
  try {
    const res = await fetch("/api/sync", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    });
    if (res.status === 503) {
      const msg =
        "Cloud sync is not configured on this deployment. Schedule was saved on this device only.";
      if (required) throw new CloudSyncError(msg);
      return false;
    }
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) detail = body.error;
      } catch {
        /* ignore */
      }
      const msg = `Could not save schedule to the cloud (${detail}). Check your connection and try Import again.`;
      if (required) throw new CloudSyncError(msg);
      console.warn("[cloud-sync] push failed", detail);
      return false;
    }
    return true;
  } catch (err) {
    if (err instanceof CloudSyncError) throw err;
    const msg =
      err instanceof Error
        ? `Could not reach cloud sync: ${err.message}`
        : "Could not reach cloud sync.";
    if (required) throw new CloudSyncError(msg);
    console.warn("[cloud-sync] push error", err);
    return false;
  }
}

/** Debounced push after local mutations (marks, import, settings, etc.). */
export function scheduleCloudPush(delayMs = 800): void {
  if (!syncEnabled || typeof window === "undefined") return;
  if (!getBoundUserId()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void flushCloudPush();
  }, delayMs);
}

export async function flushCloudPush(): Promise<void> {
  if (!syncEnabled || !getBoundUserId()) return;
  if (pushInFlight) {
    await pushInFlight;
    return;
  }
  pushInFlight = pushLocalToCloud().then(() => undefined);
  try {
    await pushInFlight;
  } finally {
    pushInFlight = null;
  }
}

/**
 * After binding Dexie for a Clerk user:
 * - If cloud has data → replace local Dexie (cloud wins).
 * - Else if local has data → upload to cloud (first device / migration).
 */
export async function syncAfterBind(): Promise<"pulled" | "pushed" | "noop" | "skipped"> {
  if (!syncEnabled || !getBoundUserId()) return "skipped";

  const remote = await fetchPull();
  if (!remote) return "skipped";

  const local = await readLocalSnapshot();
  const localHas = snapshotHasData(local);

  if (remote.hasData) {
    // Avoid stomping while applying remote → local.
    setCloudSyncEnabled(false);
    try {
      await writeLocalSnapshot(remote.snapshot);
    } finally {
      setCloudSyncEnabled(true);
    }
    return "pulled";
  }

  if (localHas) {
    const ok = await pushLocalToCloud();
    return ok ? "pushed" : "skipped";
  }

  return "noop";
}
