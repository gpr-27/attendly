import type {
  AttendanceRecord,
  CalendarBlock,
  ClassSession,
  ComponentTargets,
  DayOfWeek,
  ExceptionType,
  OdCountsAs,
  PeriodSlot,
  PreClassLeadMinutes,
  SeriesException,
  SessionRelevance,
  SessionSource,
  SessionStatus,
  SessionType,
  Settings,
  Subject,
  ThemeMode,
  TimetableSeries,
  WeekParity,
  AttendanceStatus,
  CalendarBlockKind,
} from "@/lib/db/types";
import { SETTINGS_ID } from "@/lib/db/types";
import type { Database, Json } from "./database.types";

type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];
type SubjectRow = Database["public"]["Tables"]["subjects"]["Row"];
type SeriesRow = Database["public"]["Tables"]["timetable_series"]["Row"];
type ExceptionRow = Database["public"]["Tables"]["series_exceptions"]["Row"];
type BlockRow = Database["public"]["Tables"]["calendar_blocks"]["Row"];
type SessionRow = Database["public"]["Tables"]["class_sessions"]["Row"];
type AttendanceRow = Database["public"]["Tables"]["attendance_records"]["Row"];

function asPeriodSlots(value: Json): PeriodSlot[] {
  if (!Array.isArray(value)) return [];
  const out: PeriodSlot[] = [];
  for (const slot of value) {
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue;
    const row = slot as Record<string, unknown>;
    if (
      typeof row.label === "string" &&
      typeof row.startTime === "string" &&
      typeof row.endTime === "string"
    ) {
      out.push({
        label: row.label,
        startTime: row.startTime,
        endTime: row.endTime,
      });
    }
  }
  return out;
}

function asComponentTargets(value: Json | null): ComponentTargets | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as unknown as ComponentTargets;
}

export function settingsToRow(
  clerkUserId: string,
  settings: Settings,
): SettingsRow {
  return {
    clerk_user_id: clerkUserId,
    id: SETTINGS_ID,
    semester_name: settings.semesterName,
    semester_start: settings.semesterStart,
    semester_end: settings.semesterEnd,
    target_pct: settings.targetPct,
    buffer_pct: settings.bufferPct,
    timezone: settings.timezone,
    working_days: settings.workingDays as number[],
    period_slots: settings.periodSlots as unknown as Json,
    od_counts_as: settings.odCountsAs,
    late_counts_as_present: settings.lateCountsAsPresent,
    theme: settings.theme,
    high_contrast: settings.highContrast,
    reduced_motion: settings.reducedMotion,
    large_tap_targets: settings.largeTapTargets,
    use_24h: settings.use24h,
    onboarded: settings.onboarded,
    notify_enabled: settings.notifyEnabled,
    notify_pre_class: settings.notifyPreClass,
    notify_pre_class_minutes: settings.notifyPreClassMinutes,
    notify_post_class: settings.notifyPostClass,
    notify_critical: settings.notifyCritical,
    updated_at: settings.updatedAt,
  };
}

export function settingsFromRow(row: SettingsRow): Settings {
  return {
    id: SETTINGS_ID,
    semesterName: row.semester_name,
    semesterStart: row.semester_start,
    semesterEnd: row.semester_end,
    targetPct: Number(row.target_pct),
    bufferPct: Number(row.buffer_pct),
    timezone: row.timezone,
    workingDays: row.working_days as DayOfWeek[],
    periodSlots: asPeriodSlots(row.period_slots),
    odCountsAs: row.od_counts_as as OdCountsAs,
    lateCountsAsPresent: row.late_counts_as_present,
    theme: row.theme as ThemeMode,
    highContrast: row.high_contrast,
    reducedMotion: row.reduced_motion,
    largeTapTargets: row.large_tap_targets,
    use24h: row.use_24h,
    onboarded: row.onboarded,
    notifyEnabled: row.notify_enabled,
    notifyPreClass: row.notify_pre_class,
    notifyPreClassMinutes: row.notify_pre_class_minutes as PreClassLeadMinutes,
    notifyPostClass: row.notify_post_class,
    notifyCritical: row.notify_critical,
    updatedAt: row.updated_at,
  };
}

export function subjectToRow(clerkUserId: string, s: Subject): SubjectRow {
  return {
    id: s.id,
    clerk_user_id: clerkUserId,
    name: s.name,
    short_code: s.shortCode,
    color: s.color,
    target_pct: s.targetPct ?? null,
    component_targets: (s.componentTargets as unknown as Json) ?? null,
    archived: s.archived ?? false,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export function subjectFromRow(row: SubjectRow): Subject {
  return {
    id: row.id,
    name: row.name,
    shortCode: row.short_code,
    color: row.color,
    targetPct: row.target_pct == null ? undefined : Number(row.target_pct),
    componentTargets: asComponentTargets(row.component_targets),
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function seriesToRow(
  clerkUserId: string,
  s: TimetableSeries,
): SeriesRow {
  return {
    id: s.id,
    clerk_user_id: clerkUserId,
    subject_id: s.subjectId,
    day_of_week: s.dayOfWeek,
    start_time: s.startTime,
    end_time: s.endTime,
    location: s.location ?? null,
    session_type: s.sessionType,
    target_pct: s.targetPct ?? null,
    week_parity: s.weekParity ?? "all",
    effective_from: s.effectiveFrom,
    effective_to: s.effectiveTo ?? null,
    counts_toward_attendance: s.countsTowardAttendance,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export function seriesFromRow(row: SeriesRow): TimetableSeries {
  return {
    id: row.id,
    subjectId: row.subject_id,
    dayOfWeek: row.day_of_week as DayOfWeek,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location ?? undefined,
    sessionType: row.session_type as SessionType,
    targetPct: row.target_pct == null ? undefined : Number(row.target_pct),
    weekParity: (row.week_parity as WeekParity) ?? "all",
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    countsTowardAttendance: row.counts_toward_attendance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function exceptionToRow(
  clerkUserId: string,
  e: SeriesException,
): ExceptionRow {
  return {
    id: e.id,
    clerk_user_id: clerkUserId,
    series_id: e.seriesId,
    date: e.date,
    type: e.type,
    new_start_time: e.newStartTime ?? null,
    new_end_time: e.newEndTime ?? null,
    new_location: e.newLocation ?? null,
    reason: e.reason ?? null,
    created_at: e.createdAt,
  };
}

export function exceptionFromRow(row: ExceptionRow): SeriesException {
  return {
    id: row.id,
    seriesId: row.series_id,
    date: row.date,
    type: row.type as ExceptionType,
    newStartTime: row.new_start_time ?? undefined,
    newEndTime: row.new_end_time ?? undefined,
    newLocation: row.new_location ?? undefined,
    reason: row.reason ?? undefined,
    createdAt: row.created_at,
  };
}

export function blockToRow(clerkUserId: string, b: CalendarBlock): BlockRow {
  return {
    id: b.id,
    clerk_user_id: clerkUserId,
    kind: b.kind,
    title: b.title,
    starts_on: b.startsOn,
    ends_on: b.endsOn,
    suppresses_teaching: b.suppressesTeaching,
    created_at: b.createdAt,
  };
}

export function blockFromRow(row: BlockRow): CalendarBlock {
  return {
    id: row.id,
    kind: row.kind as CalendarBlockKind,
    title: row.title,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    suppressesTeaching: row.suppresses_teaching,
    createdAt: row.created_at,
  };
}

export function sessionToRow(
  clerkUserId: string,
  s: ClassSession,
): SessionRow {
  return {
    id: s.id,
    clerk_user_id: clerkUserId,
    occurrence_key: s.occurrenceKey,
    subject_id: s.subjectId,
    series_id: s.seriesId ?? null,
    original_start: s.originalStart ?? null,
    starts_at: s.startsAt,
    ends_at: s.endsAt,
    location: s.location ?? null,
    session_type: s.sessionType,
    source: s.source,
    status: s.status,
    counts_toward_attendance: s.countsTowardAttendance,
    relevance: s.relevance,
    replaces_session_id: s.replacesSessionId ?? null,
    note: s.note ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export function sessionFromRow(row: SessionRow): ClassSession {
  return {
    id: row.id,
    occurrenceKey: row.occurrence_key,
    subjectId: row.subject_id,
    seriesId: row.series_id,
    originalStart: row.original_start,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location ?? undefined,
    sessionType: row.session_type as SessionType,
    source: row.source as SessionSource,
    status: row.status as SessionStatus,
    countsTowardAttendance: row.counts_toward_attendance,
    relevance: row.relevance as SessionRelevance,
    replacesSessionId: row.replaces_session_id,
    note: row.note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function attendanceToRow(
  clerkUserId: string,
  a: AttendanceRecord,
): AttendanceRow {
  return {
    id: a.id,
    clerk_user_id: clerkUserId,
    session_id: a.sessionId,
    status: a.status,
    marked_at: a.markedAt,
    note: a.note ?? null,
  };
}

export function attendanceFromRow(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    status: row.status as AttendanceStatus,
    markedAt: row.marked_at,
    note: row.note ?? undefined,
  };
}
