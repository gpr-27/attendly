import { getSupabaseAdmin } from "./admin";
import {
  attendanceFromRow,
  attendanceToRow,
  blockFromRow,
  blockToRow,
  exceptionFromRow,
  exceptionToRow,
  seriesFromRow,
  seriesToRow,
  sessionFromRow,
  sessionToRow,
  settingsFromRow,
  settingsToRow,
  subjectFromRow,
  subjectToRow,
} from "./mappers";
import {
  emptySnapshot,
  type CloudSnapshot,
} from "./snapshot";

const TABLES = [
  "settings",
  "subjects",
  "timetable_series",
  "series_exceptions",
  "calendar_blocks",
  "class_sessions",
  "attendance_records",
] as const;

async function chunkedUpsert<T extends Record<string, unknown>>(
  table: (typeof TABLES)[number],
  rows: T[],
): Promise<void> {
  if (rows.length === 0) return;
  const sb = getSupabaseAdmin();
  const size = 200;
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    const { error } = await sb.from(table).upsert(slice as never, {
      onConflict: table === "settings" ? "clerk_user_id" : "clerk_user_id,id",
    });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

/** Pull full snapshot for a Clerk user from Supabase (service role). */
export async function pullCloudSnapshot(
  clerkUserId: string,
): Promise<CloudSnapshot> {
  const sb = getSupabaseAdmin();
  const [
    settingsRes,
    subjectsRes,
    seriesRes,
    exceptionsRes,
    blocksRes,
    sessionsRes,
    attendanceRes,
  ] = await Promise.all([
    sb.from("settings").select("*").eq("clerk_user_id", clerkUserId).maybeSingle(),
    sb.from("subjects").select("*").eq("clerk_user_id", clerkUserId),
    sb.from("timetable_series").select("*").eq("clerk_user_id", clerkUserId),
    sb.from("series_exceptions").select("*").eq("clerk_user_id", clerkUserId),
    sb.from("calendar_blocks").select("*").eq("clerk_user_id", clerkUserId),
    sb.from("class_sessions").select("*").eq("clerk_user_id", clerkUserId),
    sb.from("attendance_records").select("*").eq("clerk_user_id", clerkUserId),
  ]);

  for (const res of [
    settingsRes,
    subjectsRes,
    seriesRes,
    exceptionsRes,
    blocksRes,
    sessionsRes,
    attendanceRes,
  ]) {
    if (res.error) {
      throw new Error(`Cloud pull failed: ${res.error.message}`);
    }
  }

  const snap = emptySnapshot();
  if (settingsRes.data) snap.settings = settingsFromRow(settingsRes.data);
  snap.subjects = (subjectsRes.data ?? []).map(subjectFromRow);
  snap.timetableSeries = (seriesRes.data ?? []).map(seriesFromRow);
  snap.seriesExceptions = (exceptionsRes.data ?? []).map(exceptionFromRow);
  snap.calendarBlocks = (blocksRes.data ?? []).map(blockFromRow);
  snap.classSessions = (sessionsRes.data ?? []).map(sessionFromRow);
  snap.attendanceRecords = (attendanceRes.data ?? []).map(attendanceFromRow);
  return snap;
}

/**
 * Replace all cloud rows for this user with the given snapshot.
 * Cloud is source of truth after a successful push.
 */
export async function pushCloudSnapshot(
  clerkUserId: string,
  snap: CloudSnapshot,
): Promise<void> {
  const sb = getSupabaseAdmin();

  // Delete in FK-safe order (attendance → sessions → … → settings).
  for (const table of [
    "attendance_records",
    "class_sessions",
    "series_exceptions",
    "timetable_series",
    "calendar_blocks",
    "subjects",
    "settings",
  ] as const) {
    const { error } = await sb
      .from(table)
      .delete()
      .eq("clerk_user_id", clerkUserId);
    if (error) throw new Error(`${table} delete failed: ${error.message}`);
  }

  if (snap.settings) {
    await chunkedUpsert("settings", [
      settingsToRow(clerkUserId, snap.settings),
    ]);
  }
  await chunkedUpsert(
    "subjects",
    snap.subjects.map((s) => subjectToRow(clerkUserId, s)),
  );
  await chunkedUpsert(
    "timetable_series",
    snap.timetableSeries.map((s) => seriesToRow(clerkUserId, s)),
  );
  await chunkedUpsert(
    "series_exceptions",
    snap.seriesExceptions.map((e) => exceptionToRow(clerkUserId, e)),
  );
  await chunkedUpsert(
    "calendar_blocks",
    snap.calendarBlocks.map((b) => blockToRow(clerkUserId, b)),
  );
  await chunkedUpsert(
    "class_sessions",
    snap.classSessions.map((s) => sessionToRow(clerkUserId, s)),
  );
  await chunkedUpsert(
    "attendance_records",
    snap.attendanceRecords.map((a) => attendanceToRow(clerkUserId, a)),
  );
}
