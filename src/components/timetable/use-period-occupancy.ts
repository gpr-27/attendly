"use client";

import { useEffect, useMemo, useState } from "react";
import type { PeriodSlot } from "@/lib/db";
import type { PeriodSlotOccupancy } from "@/lib/timetable/slot-overlap";

type UsePeriodOccupancyArgs = {
  enabled: boolean;
  /** YYYY-MM-DD probe day for free/taken chips. */
  date: string | null | undefined;
  slots: PeriodSlot[];
  excludeSessionId?: string | null;
  excludeSeriesId?: string | null;
};

/**
 * Loads free/taken occupancy for period chips when date or slots change.
 */
export function usePeriodOccupancy({
  enabled,
  date,
  slots,
  excludeSessionId,
  excludeSeriesId,
}: UsePeriodOccupancyArgs): PeriodSlotOccupancy[] | null {
  const [occupancy, setOccupancy] = useState<PeriodSlotOccupancy[] | null>(
    null,
  );
  const slotsKey = useMemo(
    () => slots.map((s) => `${s.startTime}|${s.endTime}`).join(";"),
    [slots],
  );

  useEffect(() => {
    if (!enabled || !date || slots.length === 0) {
      setOccupancy(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { getPeriodSlotsOccupancy } = await import(
          "@/lib/timetable/slot-overlap"
        );
        const next = await getPeriodSlotsOccupancy({
          date,
          slots,
          excludeSessionId,
          excludeSeriesId,
        });
        if (!cancelled) setOccupancy(next);
      } catch {
        if (!cancelled) setOccupancy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // slotsKey tracks contents; slots array identity may change each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [enabled, date, slotsKey, excludeSessionId, excludeSeriesId]);

  return occupancy;
}
