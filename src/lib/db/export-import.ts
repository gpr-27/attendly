import { db } from "./database"
import { clearAllData } from "./repository"
import {
  BACKUP_VERSION,
  SUPPORTED_BACKUP_VERSIONS,
  type BackupPayload,
  type Settings,
} from "./types"

/** Alias for older call sites / docs. */
export type AttendlyBackup = BackupPayload

const ALL_TABLES = [
  db.settings,
  db.subjects,
  db.timetableSeries,
  db.seriesExceptions,
  db.calendarBlocks,
  db.classSessions,
  db.attendanceRecords,
] as const

function isSupportedVersion(version: unknown): version is number {
  return (
    typeof version === "number" &&
    (SUPPORTED_BACKUP_VERSIONS as readonly number[]).includes(version)
  )
}

/**
 * Export schedule & settings only — never includes attendance marks.
 * Friends / other devices get a clean slate for present/absent.
 */
export async function exportBackup(): Promise<BackupPayload> {
  const [
    settingsRows,
    subjects,
    timetableSeries,
    seriesExceptions,
    calendarBlocks,
    classSessions,
  ] = await Promise.all([
    db.settings.toArray(),
    db.subjects.toArray(),
    db.timetableSeries.toArray(),
    db.seriesExceptions.toArray(),
    db.calendarBlocks.toArray(),
    db.classSessions.toArray(),
  ])

  return {
    version: BACKUP_VERSION,
    scope: "schedule",
    exportedAt: new Date().toISOString(),
    settings: (settingsRows[0] as Settings | undefined) ?? null,
    subjects,
    timetableSeries,
    seriesExceptions,
    calendarBlocks,
    classSessions,
    attendanceRecords: [],
  }
}

export async function exportBackupJson(pretty = true): Promise<string> {
  const payload = await exportBackup()
  return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload)
}

export async function exportAll(): Promise<BackupPayload> {
  return exportBackup()
}

/** Filename like `attendly-schedule-2026-08-05.json`. */
export function scheduleBackupFilename(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10)
  return `attendly-schedule-${ymd}.json`
}

/** Trigger a browser download of the schedule backup JSON. */
export async function downloadScheduleBackup(): Promise<string> {
  const json = await exportBackupJson(true)
  const filename = scheduleBackupFilename()
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return filename
}

export function parseBackupJson(raw: string): BackupPayload {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(
      "That file is not valid JSON. Pick an Attendly schedule export (.json).",
    )
  }
  if (!data || typeof data !== "object") {
    throw new Error("Backup file must be a JSON object.")
  }

  const root = data as Record<string, unknown>
  const body =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root

  const version = (body.version ?? root.version) as number | undefined
  if (!isSupportedVersion(version)) {
    throw new Error(
      version == null
        ? "This file is missing a backup version — it may not be an Attendly export."
        : `Unsupported backup version: ${String(version)} (supported: ${SUPPORTED_BACKUP_VERSIONS.join(", ")}). Export again from a newer Attendly.`,
    )
  }

  const hasStructure =
    body.settings != null ||
    Array.isArray(body.subjects) ||
    Array.isArray(body.timetableSeries) ||
    Array.isArray(body.calendarBlocks)

  if (!hasStructure) {
    throw new Error(
      "This JSON does not look like an Attendly schedule backup (no settings/subjects/timetable).",
    )
  }

  return {
    version,
    scope: "schedule",
    exportedAt:
      typeof body.exportedAt === "string"
        ? body.exportedAt
        : typeof root.exportedAt === "string"
          ? root.exportedAt
          : "",
    settings: (body.settings as Settings | null) ?? null,
    subjects: Array.isArray(body.subjects) ? body.subjects : [],
    timetableSeries: Array.isArray(body.timetableSeries)
      ? body.timetableSeries
      : [],
    seriesExceptions: Array.isArray(body.seriesExceptions)
      ? body.seriesExceptions
      : [],
    calendarBlocks: Array.isArray(body.calendarBlocks)
      ? body.calendarBlocks
      : [],
    classSessions: Array.isArray(body.classSessions) ? body.classSessions : [],
    // Marks are never restored — even if an older full dump included them.
    attendanceRecords: [],
  }
}

async function rematerializeBestEffort(): Promise<void> {
  try {
    const { ensureSessionsMaterialized } = await import("@/lib/timetable")
    await ensureSessionsMaterialized()
  } catch {
    // No semester range / empty series — structure still imported.
  }
}

/**
 * Replace local schedule & settings. Clears marks; never imports attendance.
 * Rematerializes sessions from series when semester dates exist.
 */
export async function importBackup(
  payload: BackupPayload,
  options?: { clearFirst?: boolean; rematerialize?: boolean },
): Promise<void> {
  const clearFirst = options?.clearFirst ?? true
  const shouldRematerialize = options?.rematerialize ?? true
  if (clearFirst) await clearAllData()

  await db.transaction("rw", [...ALL_TABLES], async () => {
    // Explicitly clear marks even if clearFirst was false.
    await db.attendanceRecords.clear()

    if (payload.settings) await db.settings.put(payload.settings)
    if (payload.subjects.length) await db.subjects.bulkPut(payload.subjects)
    if (payload.timetableSeries.length) {
      await db.timetableSeries.bulkPut(payload.timetableSeries)
    }
    if (payload.seriesExceptions.length) {
      await db.seriesExceptions.bulkPut(payload.seriesExceptions)
    }
    if (payload.calendarBlocks.length) {
      await db.calendarBlocks.bulkPut(payload.calendarBlocks)
    }
    if (payload.classSessions.length) {
      await db.classSessions.bulkPut(payload.classSessions)
    }
  })

  if (shouldRematerialize) {
    await rematerializeBestEffort()
  }
}

export async function importBackupJson(
  raw: string,
  options?: { clearFirst?: boolean; rematerialize?: boolean },
): Promise<void> {
  await importBackup(parseBackupJson(raw), options)
}

export async function importAll(data: unknown): Promise<void> {
  if (typeof data === "string") {
    await importBackupJson(data)
    return
  }
  if (data && typeof data === "object" && "version" in data) {
    const parsed = parseBackupJson(JSON.stringify(data))
    await importBackup(parsed)
    return
  }
  if (data && typeof data === "object") {
    const partial = data as Partial<BackupPayload>
    await importBackup({
      version: BACKUP_VERSION,
      scope: "schedule",
      exportedAt: new Date().toISOString(),
      settings: partial.settings ?? null,
      subjects: partial.subjects ?? [],
      timetableSeries: partial.timetableSeries ?? [],
      seriesExceptions: partial.seriesExceptions ?? [],
      calendarBlocks: partial.calendarBlocks ?? [],
      classSessions: partial.classSessions ?? [],
      attendanceRecords: [],
    })
  }
}
