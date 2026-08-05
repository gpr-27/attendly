import type {
  AttendanceComponent,
  ComponentTargets,
  SessionType,
} from "@/lib/db/types";

export type { AttendanceComponent, ComponentTargets };

/**
 * Map a session/slot type onto a component bucket.
 * lecture counts as theory; other has no component override.
 */
export function componentKindForSessionType(
  sessionType: SessionType | string | undefined,
): AttendanceComponent | null {
  if (sessionType === "lab") return "lab";
  if (sessionType === "tutorial") return "tutorial";
  if (sessionType === "theory" || sessionType === "lecture") return "theory";
  return null;
}

export type ResolveCollegeTargetInput = {
  settingsTargetPct: number;
  subjectTargetPct?: number;
  componentTargets?: ComponentTargets;
  sessionType?: SessionType | string;
  /** Series/slot override — highest priority when set. */
  seriesTargetPct?: number;
};

/**
 * College minimum for standing math.
 * Priority: series → subject component → subject overall → settings.
 */
export function resolveCollegeTargetPct(
  input: ResolveCollegeTargetInput,
): number {
  if (input.seriesTargetPct != null && Number.isFinite(input.seriesTargetPct)) {
    return input.seriesTargetPct;
  }
  const kind = componentKindForSessionType(input.sessionType);
  if (kind && input.componentTargets?.[kind] != null) {
    return input.componentTargets[kind] as number;
  }
  if (input.subjectTargetPct != null && Number.isFinite(input.subjectTargetPct)) {
    return input.subjectTargetPct;
  }
  return input.settingsTargetPct;
}
