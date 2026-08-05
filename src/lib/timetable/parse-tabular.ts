import type { ParseTimetableResult } from "@/lib/ai/schemas"
import type { DayOfWeek } from "@/lib/db"

const DAY_ALIASES: Record<string, DayOfWeek> = {
  sun: 0,
  sunday: 0,
  "0": 0,
  mon: 1,
  monday: 1,
  "1": 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  "2": 2,
  wed: 3,
  wednesday: 3,
  "3": 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  "4": 4,
  fri: 5,
  friday: 5,
  "5": 5,
  sat: 6,
  saturday: 6,
  "6": 6,
}

function normalizeTime(raw: string): string | null {
  const t = raw.trim().replace(/\./g, ":")
  const m = t.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2]
  const ap = m[3]?.toLowerCase()
  if (ap === "pm" && h < 12) h += 12
  if (ap === "am" && h === 12) h = 0
  if (h > 23 || Number(min) > 59) return null
  return `${String(h).padStart(2, "0")}:${min}`
}

function parseDay(raw: string): DayOfWeek | null {
  const key = raw.trim().toLowerCase()
  if (key in DAY_ALIASES) return DAY_ALIASES[key]!
  return null
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === "," && !inQuotes) {
      cells.push(cur.trim())
      cur = ""
      continue
    }
    cur += ch
  }
  cells.push(cur.trim())
  return cells
}

type HeaderMap = {
  shortCode?: number
  name?: number
  day?: number
  start?: number
  end?: number
  location?: number
}

function mapHeaders(cells: string[]): HeaderMap | null {
  const lower = cells.map((c) => c.toLowerCase().replace(/\s+/g, ""))
  const find = (...names: string[]) => {
    for (const n of names) {
      const i = lower.indexOf(n)
      if (i >= 0) return i
    }
    return undefined
  }
  const day = find("dayofweek", "day", "weekday")
  const start = find("start", "starttime", "from")
  const end = find("end", "endtime", "to")
  const shortCode = find("shortcode", "code", "subjectshortcode", "subjectcode")
  if (day == null || start == null || end == null || shortCode == null) {
    return null
  }
  return {
    shortCode,
    name: find("name", "subject", "subjectname"),
    day,
    start,
    end,
    location: find("location", "room", "venue"),
  }
}

/**
 * Parse CSV text into the same shape as photo import preview.
 * Expected headers (flexible): shortCode, name?, dayOfWeek|day, start, end, location?
 */
export function parseTimetableCsv(text: string): ParseTimetableResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))

  if (lines.length === 0) {
    throw new Error("CSV is empty")
  }

  const headerCells = splitCsvLine(lines[0]!)
  let header = mapHeaders(headerCells)
  let dataStart = 1

  // Headerless: shortCode,name,day,start,end[,location]
  if (!header && headerCells.length >= 5) {
    const maybeDay = parseDay(headerCells[2] ?? "")
    const maybeStart = normalizeTime(headerCells[3] ?? "")
    if (maybeDay != null && maybeStart) {
      header = {
        shortCode: 0,
        name: 1,
        day: 2,
        start: 3,
        end: 4,
        location: headerCells.length > 5 ? 5 : undefined,
      }
      dataStart = 0
    }
  }

  if (!header) {
    throw new Error(
      "CSV needs headers: shortCode, day (or dayOfWeek), start, end — optional name, location",
    )
  }

  const subjects = new Map<string, { name: string; shortCode: string }>()
  const slots: ParseTimetableResult["slots"] = []

  for (let i = dataStart; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!)
    const code = (cells[header.shortCode!] ?? "").trim()
    if (!code) continue
    const day = parseDay(cells[header.day!] ?? "")
    const start = normalizeTime(cells[header.start!] ?? "")
    const end = normalizeTime(cells[header.end!] ?? "")
    if (day == null || !start || !end) continue

    const name =
      (header.name != null ? cells[header.name]?.trim() : "") || code
    const upper = code.toUpperCase()
    if (!subjects.has(upper)) {
      subjects.set(upper, { shortCode: code, name })
    }

    const location =
      header.location != null
        ? cells[header.location]?.trim() || undefined
        : undefined

    slots.push({
      subjectShortCode: code,
      dayOfWeek: day,
      start,
      end,
      location,
    })
  }

  if (subjects.size === 0 || slots.length === 0) {
    throw new Error("No valid timetable rows found in CSV")
  }

  return {
    subjects: [...subjects.values()],
    slots,
    notes: `Imported ${slots.length} slots from CSV`,
  }
}

/** Build ParseTimetableResult from a sheet of string rows (Excel → AOA). */
export function parseTimetableRows(
  rows: string[][],
): ParseTimetableResult {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "")
          return s.includes(",") || s.includes('"')
            ? `"${s.replace(/"/g, '""')}"`
            : s
        })
        .join(","),
    )
    .join("\n")
  return parseTimetableCsv(csv)
}
