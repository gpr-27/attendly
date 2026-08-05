/**
 * Delete cancelled occurrences and move/reschedule sessions.
 * Shared by Today / Timetable UI and AI chat actions.
 */
import {
  clearAttendance,
  db,
  deleteExceptionForOccurrence,
  getSession,
  getSeries,
  putSession,
  updateSeries,
  upsertException,
  type ClassSession,
  type DayOfWeek,
} from "@/lib/db"
import { sessionLocalYmd } from "@/lib/dates"
import { ensureSessionsMaterialized } from "./ensure-materialized"
import {
  addExtraSession,
  cancelSessionOccurrence,
  localDateTimeIso,
  materializeSessions,
  modifySeriesOccurrence,
} from "./materialize-sessions"

export type MoveSessionScope = "this_date" | "entire_pattern"

export type MoveSessionInput = {
  sessionId: string
  newDate: string
  startTime: string
  endTime: string
  location?: string
  /** Default: this date only. entire_pattern rewrites the master weekly slot. */
  scope?: MoveSessionScope
}

export type MoveSessionResult = {
  mode: MoveSessionScope
  /** Session id after move (may be a new extra on a different day). */
  sessionId: string
  fromDate: string
  toDate: string
}

function sessionLocalDate(session: ClassSession): string {
  return sessionLocalYmd(session)
}

function dayOfWeekFromYmd(ymd: string): DayOfWeek {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d).getDay() as DayOfWeek
}

function assertValidTimes(startTime: string, endTime: string): void {
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    throw new Error("Times must be HH:mm.")
  }
  if (endTime <= startTime) {
    throw new Error("End time must be after start time.")
  }
}

/**
 * Remove a cancelled (or holiday) occurrence from day views.
 * Series: writes `seriesExceptions` type deleted + removes the session row.
 * Extra / one-off: deletes the session (and any mark).
 */
export async function deleteCancelledOccurrence(
  sessionId: string,
): Promise<boolean> {
  const session = await getSession(sessionId)
  if (!session) return false
  if (session.status !== "cancelled" && session.status !== "holiday") {
    throw new Error("Only cancelled (or holiday) classes can be deleted.")
  }

  await clearAttendance(sessionId)

  if (session.seriesId) {
    const date = sessionLocalDate(session)
    await upsertException({
      seriesId: String(session.seriesId),
      date,
      type: "deleted",
      reason: "Removed from day view",
    })
    await db.classSessions.delete(sessionId)
    // Rematerialize so cleanup stays consistent; deleted exception skips recreate.
    await materializeSessions({ from: date, to: date })
    return true
  }

  await db.classSessions.delete(sessionId)
  return true
}

/** True for Extra / makeup / one-off sessions (no weekly series). */
export function isRemovableExtraSession(
  session: Pick<ClassSession, "seriesId" | "source" | "status">,
): boolean {
  if (session.seriesId) return false
  if (session.status === "cancelled" || session.status === "holiday") {
    return false
  }
  return (
    session.source === "extra" ||
    session.source === "one_off" ||
    session.source === "substitution"
  )
}

/**
 * Hard-delete an Extra / makeup session from Dexie (and any attendance mark).
 * Pattern/series classes use Cancel instead.
 */
export async function removeExtraSession(
  sessionId: string,
): Promise<boolean> {
  const session = await getSession(sessionId)
  if (!session) return false
  if (!isRemovableExtraSession(session)) {
    throw new Error(
      "Only Extra / makeup classes can be removed this way. Use Cancel for weekly pattern classes.",
    )
  }
  await clearAttendance(sessionId)
  await db.classSessions.delete(sessionId)
  return true
}

/**
 * Move / reschedule one class to a new date + time.
 * - this_date: same day → modified exception (or patch extra); other day →
 *   hide original + create one-off on the new date.
 * - entire_pattern: rewrite master weekly dayOfWeek + times (permanent).
 */
export async function moveSessionOccurrence(
  input: MoveSessionInput,
): Promise<MoveSessionResult> {
  const scope: MoveSessionScope = input.scope ?? "this_date"
  assertValidTimes(input.startTime, input.endTime)

  const session = await getSession(input.sessionId)
  if (!session) throw new Error("Class not found.")
  if (session.status === "cancelled" || session.status === "holiday") {
    throw new Error("Restore or delete the cancelled class before moving it.")
  }

  const fromDate = sessionLocalDate(session)
  const toDate = input.newDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw new Error("Pick a valid date (YYYY-MM-DD).")
  }

  if (scope === "entire_pattern") {
    if (!session.seriesId) {
      throw new Error(
        "Extras have no weekly pattern — move this date only, or add a permanent slot in Original timetable.",
      )
    }
    const series = await getSeries(String(session.seriesId))
    if (!series) throw new Error("Weekly slot not found.")

    await updateSeries(String(series.id), {
      dayOfWeek: dayOfWeekFromYmd(toDate),
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location ?? series.location,
    })
    // Clear one-day exceptions on the old date so the move isn’t fighting them.
    await deleteExceptionForOccurrence(String(series.id), fromDate)
    await ensureSessionsMaterialized()
    const updated = await getSession(input.sessionId)
    return {
      mode: scope,
      sessionId: updated?.id ?? input.sessionId,
      fromDate,
      toDate,
    }
  }

  // —— this_date ——
  if (fromDate === toDate) {
    if (session.seriesId) {
      await modifySeriesOccurrence(String(session.seriesId), fromDate, {
        newStartTime: input.startTime,
        newEndTime: input.endTime,
        newLocation: input.location,
        reason: "Moved for this date only",
      })
      return {
        mode: scope,
        sessionId: input.sessionId,
        fromDate,
        toDate,
      }
    }
    const stamp = new Date().toISOString()
    await putSession({
      ...session,
      startsAt: localDateTimeIso(toDate, input.startTime),
      endsAt: localDateTimeIso(toDate, input.endTime),
      location: input.location ?? session.location,
      updatedAt: stamp,
    })
    return { mode: scope, sessionId: input.sessionId, fromDate, toDate }
  }

  // Different day — hide original, create one-off on target date.
  const subjectId = String(session.subjectId)
  const location = input.location ?? session.location
  const note = `Moved from ${fromDate}`

  if (session.seriesId) {
    await upsertException({
      seriesId: String(session.seriesId),
      date: fromDate,
      type: "deleted",
      reason: `Moved to ${toDate}`,
    })
    await clearAttendance(session.id)
    await db.classSessions.delete(session.id)
    await materializeSessions({ from: fromDate, to: fromDate })
  } else {
    await clearAttendance(session.id)
    await db.classSessions.delete(session.id)
  }

  const created = await addExtraSession({
    subjectId,
    date: toDate,
    startTime: input.startTime,
    endTime: input.endTime,
    location,
    sessionType: session.sessionType,
    relevance: "additional",
    note,
  })

  return {
    mode: scope,
    sessionId: created.id,
    fromDate,
    toDate,
  }
}

/** Cancel then optionally used by chat — wraps cancelSessionOccurrence. */
export async function cancelSessionById(
  sessionId: string,
  reason = "Cancelled",
): Promise<ClassSession | null> {
  await clearAttendance(sessionId)
  return cancelSessionOccurrence(sessionId, reason)
}
