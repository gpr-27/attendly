/** Domain types for Attendly — English names, string UUID ids. */

export type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "excused"
  | "on_duty";

export type SessionStatus =
  | "scheduled"
  | "cancelled"
  | "holiday"
  | "completed";

export type SessionRelevance =
  | "scheduled"
  | "additional"
  | "makeup"
  | "substitution";

export type SessionSource =
  | "series"
  | "exception_modified"
  | "extra"
  | "one_off"
  | "substitution"
  | "manual";

export type SessionType =
  | "lecture"
  | "theory"
  | "lab"
  | "tutorial"
  | "other";

/** Theory / lab / tutorial buckets for per-component attendance targets. */
export type AttendanceComponent = "theory" | "lab" | "tutorial";

export type ComponentTargets = Partial<
  Record<AttendanceComponent, number>
>;

/** cancelled = show as cancelled; modified = time/room change; deleted = hard-clear from day view */
export type ExceptionType = "cancelled" | "modified" | "deleted";

/**
 * Special calendar ranges inside the semester.
 * Suppressing kinds skip materializing teaching sessions on those dates.
 */
export type CalendarBlockKind =
  | "holiday"
  | "break"
  | "exam"
  | "exam_week"
  | "ct1"
  | "ct2";

/** How OD marks affect A/T in the bunk engine. */
export type OdCountsAs = "present" | "excused" | "neutral";

export type ThemeMode = "system" | "light" | "dark";

/** Pre-class local reminder lead time (minutes). */
export type PreClassLeadMinutes = 15 | 5;

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Which ISO weeks a weekly series occurs on. */
export type WeekParity = "all" | "odd" | "even";

/** One daily college period (shared across weekdays). */
export interface PeriodSlot {
  /** Display label, e.g. "Slot 1" or "Period 3". */
  label: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
}

export const SETTINGS_ID = 1;
/** Schedule/settings snapshot — attendance marks are never included. */
export const BACKUP_VERSION = 2 as const;
/** Older full dumps (v1) still import; marks are ignored. */
export const SUPPORTED_BACKUP_VERSIONS = [1, 2] as const;

export interface Settings {
  id: typeof SETTINGS_ID;
  semesterName: string;
  semesterStart: string; // YYYY-MM-DD
  semesterEnd: string;
  targetPct: number;
  bufferPct: number;
  timezone: string;
  workingDays: DayOfWeek[];
  /**
   * Fixed daily period template (college slots).
   * Used by Timetable quick-add — pick a chip instead of typing times.
   */
  periodSlots: PeriodSlot[];
  odCountsAs: OdCountsAs;
  lateCountsAsPresent: boolean;
  theme: ThemeMode;
  /** Stronger ink/line contrast for readability. */
  highContrast: boolean;
  /** Prefer less UI motion (honors user toggle; also respects OS when true). */
  reducedMotion: boolean;
  /** Bump thumb-zone / control min heights. */
  largeTapTargets: boolean;
  use24h: boolean;
  onboarded: boolean;
  /** Master intent — still needs browser Notification permission. */
  notifyEnabled: boolean;
  notifyPreClass: boolean;
  /** T−15 or T−5 before class start. */
  notifyPreClassMinutes: PreClassLeadMinutes;
  notifyPostClass: boolean;
  /** Alert when a subject’s bunk buffer (can-skip) is ≤ 1. */
  notifyCritical: boolean;
  updatedAt: string;
}

export interface Subject {
  id: string;
  name: string;
  shortCode: string;
  color: string;
  /** Optional override of settings.targetPct for this subject overall. */
  targetPct?: number;
  /** Optional per-component college mins (theory / lab / tutorial). */
  componentTargets?: ComponentTargets;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableSeries {
  id: string;
  subjectId: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:mm
  endTime: string;
  location?: string;
  sessionType: SessionType;
  /** Optional college min for this slot’s component (overrides subject/settings). */
  targetPct?: number;
  /** ISO week parity — default "all" when missing (older rows). */
  weekParity?: WeekParity;
  effectiveFrom: string;
  effectiveTo?: string | null;
  countsTowardAttendance: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SeriesException {
  id: string;
  seriesId: string;
  date: string;
  type: ExceptionType;
  newStartTime?: string;
  newEndTime?: string;
  newLocation?: string;
  reason?: string;
  createdAt: string;
}

export interface CalendarBlock {
  id: string;
  kind: CalendarBlockKind;
  title: string;
  startsOn: string;
  endsOn: string;
  suppressesTeaching: boolean;
  createdAt: string;
}

export interface ClassSession {
  id: string;
  occurrenceKey: string;
  subjectId: string;
  seriesId?: string | null;
  originalStart?: string | null;
  startsAt: string;
  endsAt: string;
  location?: string;
  sessionType: SessionType;
  source: SessionSource;
  status: SessionStatus;
  countsTowardAttendance: boolean;
  relevance: SessionRelevance;
  replacesSessionId?: string | null;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  status: AttendanceStatus;
  markedAt: string;
  note?: string;
}

/**
 * Portable schedule & settings snapshot.
 * `attendanceRecords` is always empty on export; import never restores marks.
 */
export interface BackupPayload {
  version: number;
  /** Discriminator — schedule-only (no present/absent marks). */
  scope: "schedule";
  exportedAt: string;
  settings: Settings | null;
  subjects: Subject[];
  timetableSeries: TimetableSeries[];
  seriesExceptions: SeriesException[];
  calendarBlocks: CalendarBlock[];
  /** Session rows for extras/one-offs; series sessions may rematerialize after import. */
  classSessions: ClassSession[];
  /** Always [] — kept for schema compatibility with older dumps. */
  attendanceRecords: AttendanceRecord[];
}

/** Alias used by export/import helpers. */
export type AttendlyBackup = BackupPayload;

/** Default 6 college periods — editable in Settings → Daily periods. */
export function defaultPeriodSlots(): PeriodSlot[] {
  return [
    { label: "Slot 1", startTime: "09:00", endTime: "10:00" },
    { label: "Slot 2", startTime: "10:00", endTime: "11:00" },
    { label: "Slot 3", startTime: "11:15", endTime: "12:15" },
    { label: "Slot 4", startTime: "13:00", endTime: "14:00" },
    { label: "Slot 5", startTime: "14:00", endTime: "15:00" },
    { label: "Slot 6", startTime: "15:00", endTime: "16:00" },
  ];
}

/** Empty defaults — user fills these; no invented semester/subjects. */
export function defaultSettings(): Settings {
  const now = new Date().toISOString();
  return {
    id: SETTINGS_ID,
    semesterName: "",
    semesterStart: "",
    semesterEnd: "",
    targetPct: 75,
    bufferPct: 0,
    timezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        : "UTC",
    workingDays: [1, 2, 3, 4, 5, 6],
    periodSlots: defaultPeriodSlots(),
    odCountsAs: "excused",
    lateCountsAsPresent: true,
    theme: "system",
    highContrast: false,
    reducedMotion: false,
    largeTapTargets: false,
    use24h: true,
    notifyEnabled: false,
    notifyPreClass: true,
    notifyPreClassMinutes: 15,
    notifyPostClass: true,
    notifyCritical: true,
    onboarded: false,
    updatedAt: now,
  };
}

export function seriesOccurrenceKey(seriesId: string, date: string): string {
  return `${seriesId}#${date}`;
}

/** Unique key for one-off / extra sessions. */
export function extraOccurrenceKey(sessionId: string): string {
  return `extra#${sessionId}`;
}
