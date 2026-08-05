import {
  addSeries,
  deleteSeries,
  updateSeries,
  type TimetableSeries,
} from "@/lib/db";
import { addDaysYmd } from "@/lib/dates";
import { ensureSessionsMaterialized } from "./ensure-materialized";
import {
  cancelSeriesOccurrence,
  modifySeriesOccurrence,
} from "./materialize-sessions";

/** Soft-edit scopes for changing a recurring class. */
export type EditSeriesScope = "this_date" | "all_future" | "entire_pattern";

/** Soft-cancel scopes: one day vs remove the master slot. */
export type CancelSeriesScope = "this_date" | "entire_pattern";

export type SeriesTimePatch = {
  startTime: string;
  endTime: string;
  location?: string;
};

/**
 * Apply a time/location change with explicit recurrence scope.
 * - this_date: series exception for one calendar day
 * - all_future: end old series yesterday, start a new series from `date`
 * - entire_pattern: mutate the master weekly series for all weeks
 */
export async function applySeriesEdit(args: {
  series: TimetableSeries;
  patch: SeriesTimePatch;
  scope: EditSeriesScope;
  /** Local YYYY-MM-DD — required for this_date / all_future. */
  date: string;
}): Promise<{ mode: EditSeriesScope; newSeriesId?: string }> {
  const { series, patch, scope, date } = args;
  if (patch.endTime <= patch.startTime) {
    throw new Error("End time must be after start time.");
  }

  if (scope === "this_date") {
    await modifySeriesOccurrence(String(series.id), date, {
      newStartTime: patch.startTime,
      newEndTime: patch.endTime,
      newLocation: patch.location,
      reason: "Edited for this date only",
    });
    return { mode: scope };
  }

  if (scope === "entire_pattern") {
    await updateSeries(String(series.id), {
      startTime: patch.startTime,
      endTime: patch.endTime,
      location: patch.location,
    });
    await ensureSessionsMaterialized();
    return { mode: scope };
  }

  // all_future — split the series at `date`
  const dayBefore = addDaysYmd(date, -1);
  if (dayBefore < series.effectiveFrom) {
    // Nothing before the split: just rewrite the master series.
    await updateSeries(String(series.id), {
      startTime: patch.startTime,
      endTime: patch.endTime,
      location: patch.location,
      effectiveFrom: date,
    });
    await ensureSessionsMaterialized();
    return { mode: scope, newSeriesId: String(series.id) };
  }

  await updateSeries(String(series.id), { effectiveTo: dayBefore });
  const created = await addSeries({
    subjectId: series.subjectId,
    dayOfWeek: series.dayOfWeek,
    startTime: patch.startTime,
    endTime: patch.endTime,
    location: patch.location,
    sessionType: series.sessionType ?? "lecture",
    weekParity: series.weekParity ?? "all",
    targetPct: series.targetPct,
    effectiveFrom: date,
    effectiveTo: null,
    countsTowardAttendance: series.countsTowardAttendance ?? true,
  });
  await ensureSessionsMaterialized();
  return { mode: scope, newSeriesId: String(created.id) };
}

/**
 * Cancel one occurrence or delete the weekly slot forever.
 */
export async function applySeriesCancel(args: {
  series: TimetableSeries;
  scope: CancelSeriesScope;
  date: string;
  reason?: string;
}): Promise<{ mode: CancelSeriesScope }> {
  const { series, scope, date, reason } = args;
  if (scope === "this_date") {
    await cancelSeriesOccurrence(
      String(series.id),
      date,
      reason ?? "Cancelled for this date only",
    );
    return { mode: scope };
  }

  await deleteSeries(String(series.id));
  await ensureSessionsMaterialized();
  return { mode: scope };
}
