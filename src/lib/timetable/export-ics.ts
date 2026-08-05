import type { ClassSession, Subject } from "@/lib/db"

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Format a Date as UTC ICS timestamp YYYYMMDDTHHMMSSZ. */
export function toIcsUtc(iso: string): string {
  const d = new Date(iso)
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

export type IcsExportInput = {
  sessions: ClassSession[]
  subjects: Subject[]
  calendarName?: string
}

/**
 * One-way Google Calendar–compatible .ics (no OAuth).
 * Includes scheduled sessions only (skips cancelled/holiday).
 */
export function buildSessionsIcs(input: IcsExportInput): string {
  const byId = new Map(input.subjects.map((s) => [s.id, s]))
  const stamp = toIcsUtc(new Date().toISOString())
  const name = escapeIcsText(input.calendarName ?? "Attendly")

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Attendly//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${name}`,
  ]

  for (const session of input.sessions) {
    if (session.status === "cancelled" || session.status === "holiday") {
      continue
    }
    const subject = byId.get(session.subjectId)
    const title = escapeIcsText(
      subject
        ? `${subject.shortCode} — ${subject.name}`
        : "Class",
    )
    const loc = session.location
      ? `LOCATION:${escapeIcsText(session.location)}`
      : null
    const descParts = [
      session.sessionType,
      session.relevance !== "scheduled" ? session.relevance : null,
      session.note,
    ].filter(Boolean)
    const desc = descParts.length
      ? `DESCRIPTION:${escapeIcsText(descParts.join(" · "))}`
      : null

    lines.push(
      "BEGIN:VEVENT",
      `UID:${session.id}@attendly`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(session.startsAt)}`,
      `DTEND:${toIcsUtc(session.endsAt)}`,
      `SUMMARY:${title}`,
    )
    if (loc) lines.push(loc)
    if (desc) lines.push(desc)
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")
  return lines.join("\r\n") + "\r\n"
}

/** Trigger a browser download of an .ics file. */
export function downloadIcsFile(ics: string, filename = "attendly.ics"): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
