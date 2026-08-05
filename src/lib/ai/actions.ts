/**
 * Shared Attendly action types + executors.
 * Used by Agent Control (Today / Coach / Analytics) and UI move/delete modals.
 * Keep payloads JSON-serializable for Groq structured actions.
 */
import { z } from "zod"

import {
  addSeries,
  addSubject,
  deleteSubject,
  getSession,
  getSettings,
  listSessionsInRange,
  listSubjects,
  type DayOfWeek,
  type SessionType,
} from "@/lib/db"
import { dayBoundsIso, todayYmd } from "@/lib/dates"
import {
  addExtraSession,
  cancelSessionById,
  deleteCancelledOccurrence,
  ensureSessionsMaterialized,
  findDaySlotOverlaps,
  markDateAsHoliday,
  moveSessionOccurrence,
  timesFromSlotIndex,
  type MoveSessionScope,
} from "@/lib/timetable"
import { markDaySession } from "@/lib/today/load-day-agenda"
import { extractJsonText } from "./json-text"

/** Canonical action names — chat prompts and UI should use these strings. */
export const ATTENDLY_ACTION_TYPES = [
  "addSubject",
  "deleteSubject",
  "addExtraSession",
  "cancelSession",
  "deleteSession",
  "moveSession",
  "rescheduleSession",
  "markAttendance",
  "setHoliday",
  "addWeeklySlot",
] as const

export type AttendlyActionType = (typeof ATTENDLY_ACTION_TYPES)[number]

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const hm = z.string().regex(/^\d{2}:\d{2}$/)
const dayOfWeekSchema = z.number().int().min(0).max(6)
const moveScopeSchema = z.enum(["this_date", "entire_pattern"]).optional()

export const attendlyActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addSubject"),
    name: z.string().min(1),
    shortCode: z.string().min(1).max(16),
    color: z.string().optional(),
  }),
  z.object({
    type: z.literal("deleteSubject"),
    subjectId: z.string().min(1).optional(),
    shortCode: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("addExtraSession"),
    subjectId: z.string().min(1).optional(),
    shortCode: z.string().min(1).optional(),
    date: ymd,
    startTime: hm,
    endTime: hm,
    location: z.string().optional(),
  }),
  z.object({
    type: z.literal("cancelSession"),
    sessionId: z.string().min(1),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal("deleteSession"),
    sessionId: z.string().min(1),
  }),
  z.object({
    type: z.literal("moveSession"),
    sessionId: z.string().min(1),
    newDate: ymd,
    startTime: hm,
    endTime: hm,
    location: z.string().optional(),
    scope: moveScopeSchema,
  }),
  z.object({
    type: z.literal("rescheduleSession"),
    sessionId: z.string().min(1),
    newDate: ymd,
    startTime: hm,
    endTime: hm,
    location: z.string().optional(),
    scope: moveScopeSchema,
  }),
  z.object({
    type: z.literal("markAttendance"),
    sessionId: z.string().min(1),
    status: z.enum([
      "present",
      "absent",
      "on_duty",
      "cancelled",
      "holiday",
    ]),
  }),
  z.object({
    type: z.literal("setHoliday"),
    date: ymd,
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal("addWeeklySlot"),
    subjectId: z.string().min(1).optional(),
    shortCode: z.string().min(1).optional(),
    dayOfWeek: dayOfWeekSchema,
    /** Prefer Settings period template when set (0-based). */
    slotIndex: z.number().int().min(0).max(11).optional(),
    startTime: hm.optional(),
    endTime: hm.optional(),
    location: z.string().optional(),
    sessionType: z
      .enum(["lecture", "theory", "lab", "tutorial", "other"])
      .optional(),
  }),
])

export const agentActionsPayloadSchema = z.object({
  message: z.string().min(1),
  actions: z.array(attendlyActionSchema).default([]),
  chips: z.array(z.string().min(1)).optional(),
})

export type AttendlyAction = z.infer<typeof attendlyActionSchema>
export type AgentActionsPayload = z.infer<typeof agentActionsPayloadSchema>
export type { MoveSessionScope }

const DESTRUCTIVE = new Set<AttendlyActionType>([
  "deleteSubject",
  "deleteSession",
])

export function isDestructiveAction(action: AttendlyAction): boolean {
  return DESTRUCTIVE.has(action.type)
}

export function describeAttendlyAction(action: AttendlyAction): string {
  switch (action.type) {
    case "addSubject":
      return `Add ${action.shortCode} (${action.name})`
    case "deleteSubject":
      return `Delete ${action.shortCode ?? action.subjectId ?? "subject"}`
    case "addExtraSession":
      return `Add class ${action.shortCode ?? ""} on ${action.date} ${action.startTime}`
    case "cancelSession":
      return "Cancel this class"
    case "deleteSession":
      return "Delete cancelled class"
    case "moveSession":
    case "rescheduleSession":
      return `Move to ${action.newDate} ${action.startTime}`
    case "markAttendance":
      return `Mark ${action.status.replace("_", " ")}`
    case "setHoliday":
      return `Holiday on ${action.date}`
    case "addWeeklySlot":
      return action.slotIndex != null
        ? `Weekly slot day ${action.dayOfWeek} period ${action.slotIndex + 1}`
        : `Weekly slot day ${action.dayOfWeek} ${action.startTime ?? "?"}`
    default:
      return "Action"
  }
}

/** Parse model / tool JSON into a validated actions payload. */
export function parseAgentActionsPayload(
  raw: unknown,
): AgentActionsPayload | null {
  if (typeof raw === "string") {
    try {
      return parseAgentActionsPayload(
        JSON.parse(extractJsonText(raw)) as unknown,
      )
    } catch {
      return null
    }
  }
  const parsed = agentActionsPayloadSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** Pull `{ message, actions }` from coach prose + optional JSON fence. */
export function extractActionsFromCoachReply(
  reply: string,
): AgentActionsPayload {
  const direct = parseAgentActionsPayload(reply)
  if (direct) return direct
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(reply)
  if (fenced?.[1]) {
    const nested = parseAgentActionsPayload(fenced[1])
    if (nested) return nested
  }
  const jsonish = extractJsonText(reply)
  if (jsonish.startsWith("{")) {
    const nested = parseAgentActionsPayload(jsonish)
    if (nested) return nested
  }
  return { message: reply.trim() || "OK.", actions: [] }
}

export type AttendlyActionResult = {
  ok: boolean
  type: AttendlyActionType
  message: string
  /** Optional ids for UI refresh / follow-up. */
  ids?: Record<string, string>
}

async function resolveSubjectId(args: {
  subjectId?: string
  shortCode?: string
}): Promise<string> {
  if (args.subjectId) return args.subjectId
  const code = args.shortCode?.trim()
  if (!code) throw new Error("Pick a subject (id or shortCode).")
  const subjects = await listSubjects()
  const hit = subjects.find(
    (s) => s.shortCode.toLowerCase() === code.toLowerCase(),
  )
  if (!hit) throw new Error(`Subject “${code}” not found.`)
  return hit.id
}

/**
 * Execute one grounded action against Dexie.
 * Throws on validation errors; returns a user-facing success message.
 */
export async function executeAttendlyAction(
  action: AttendlyAction,
): Promise<AttendlyActionResult> {
  switch (action.type) {
    case "addSubject": {
      const subject = await addSubject({
        name: action.name.trim(),
        shortCode: action.shortCode.trim().toUpperCase(),
        color: action.color ?? "#0f6e6a",
      })
      return {
        ok: true,
        type: action.type,
        message: `Added subject ${subject.shortCode}.`,
        ids: { subjectId: subject.id },
      }
    }
    case "deleteSubject": {
      const id = await resolveSubjectId(action)
      await deleteSubject(id)
      await ensureSessionsMaterialized().catch(() => undefined)
      return {
        ok: true,
        type: action.type,
        message: "Subject removed (slots and marks cleared).",
        ids: { subjectId: id },
      }
    }
    case "addExtraSession": {
      const subjectId = await resolveSubjectId(action)
      const overlap = await findDaySlotOverlaps({
        date: action.date,
        startTime: action.startTime,
        endTime: action.endTime,
      })
      if (!overlap.ok) {
        return { ok: false, type: action.type, message: overlap.message }
      }
      const session = await addExtraSession({
        subjectId,
        date: action.date,
        startTime: action.startTime,
        endTime: action.endTime,
        location: action.location,
        relevance: "additional",
      })
      return {
        ok: true,
        type: action.type,
        message: `Added class on ${action.date} at ${action.startTime}.`,
        ids: { sessionId: session.id },
      }
    }
    case "cancelSession": {
      const session = await cancelSessionById(
        action.sessionId,
        action.reason ?? "Cancelled",
      )
      if (!session) {
        return {
          ok: false,
          type: action.type,
          message: "Class not found.",
        }
      }
      return {
        ok: true,
        type: action.type,
        message: "Class cancelled for this date.",
        ids: { sessionId: session.id },
      }
    }
    case "deleteSession": {
      const removed = await deleteCancelledOccurrence(action.sessionId)
      if (!removed) {
        return {
          ok: false,
          type: action.type,
          message: "Class not found.",
        }
      }
      return {
        ok: true,
        type: action.type,
        message: "Cancelled class removed from day view.",
        ids: { sessionId: action.sessionId },
      }
    }
    case "moveSession":
    case "rescheduleSession": {
      const overlap = await findDaySlotOverlaps({
        date: action.newDate,
        startTime: action.startTime,
        endTime: action.endTime,
        excludeSessionId: action.sessionId,
      })
      if (!overlap.ok) {
        return { ok: false, type: action.type, message: overlap.message }
      }
      const result = await moveSessionOccurrence({
        sessionId: action.sessionId,
        newDate: action.newDate,
        startTime: action.startTime,
        endTime: action.endTime,
        location: action.location,
        scope: action.scope ?? "this_date",
      })
      const scopeNote =
        result.mode === "entire_pattern"
          ? "Permanent weekly slot updated."
          : result.fromDate === result.toDate
            ? `Moved to ${result.toDate} ${action.startTime}–${action.endTime}.`
            : `Moved from ${result.fromDate} to ${result.toDate} ${action.startTime}.`
      return {
        ok: true,
        type: action.type,
        message: scopeNote,
        ids: { sessionId: result.sessionId },
      }
    }
    case "markAttendance": {
      await markDaySession(action.sessionId, action.status)
      return {
        ok: true,
        type: action.type,
        message: `Marked ${action.status.replace("_", " ")}.`,
        ids: { sessionId: action.sessionId },
      }
    }
    case "setHoliday": {
      await markDateAsHoliday(action.date, action.title ?? "Holiday")
      return {
        ok: true,
        type: action.type,
        message: `Holiday set for ${action.date}.`,
      }
    }
    case "addWeeklySlot": {
      const subjectId = await resolveSubjectId(action)
      // Period slot required — resolve times only from Settings.periodSlots.
      if (typeof action.slotIndex !== "number") {
        throw new Error(
          "Pick a period slot (slotIndex). Custom times are not supported — edit slots in Settings → Daily periods.",
        )
      }
      const settings = await getSettings()
      const resolved = timesFromSlotIndex(settings, action.slotIndex)
      if (!resolved) {
        throw new Error(
          `Unknown period slotIndex ${action.slotIndex}. Check Settings → Daily periods.`,
        )
      }
      const startTime = resolved.startTime
      const endTime = resolved.endTime
      // Overlap check on next matching weekday from today / semester start
      const probeFrom = settings.semesterStart?.trim() || todayYmd()
      const { addDaysYmd, dayOfWeekFromYmd } = await import("@/lib/dates")
      let probe = probeFrom < todayYmd() ? todayYmd() : probeFrom
      for (let i = 0; i < 14; i += 1) {
        const ymd = addDaysYmd(probe, i)
        if (dayOfWeekFromYmd(ymd) !== action.dayOfWeek) continue
        const overlap = await findDaySlotOverlaps({
          date: ymd,
          startTime,
          endTime,
        })
        if (!overlap.ok) {
          return {
            ok: false,
            type: action.type,
            message: overlap.message,
          }
        }
        break
      }
      const series = await addSeries({
        subjectId,
        dayOfWeek: action.dayOfWeek as DayOfWeek,
        startTime,
        endTime,
        location: action.location,
        sessionType: (action.sessionType ?? "lecture") as SessionType,
        effectiveFrom: settings.semesterStart?.trim() || todayYmd(),
        effectiveTo: null,
        countsTowardAttendance: true,
      })
      await ensureSessionsMaterialized()
      return {
        ok: true,
        type: action.type,
        message: "Weekly slot added to original timetable.",
        ids: { seriesId: series.id },
      }
    }
    default: {
      const _exhaustive: never = action
      return {
        ok: false,
        type: "cancelSession",
        message: `Unknown action: ${JSON.stringify(_exhaustive)}`,
      }
    }
  }
}

/** Resolve “today’s first class” style helpers for chat. */
export async function findSessionsOnDate(ymd: string) {
  const { fromIso, toIso } = dayBoundsIso(ymd)
  return listSessionsInRange(fromIso, toIso)
}

export async function getSessionOrThrow(sessionId: string) {
  const session = await getSession(sessionId)
  if (!session) throw new Error("Class not found.")
  return session
}
