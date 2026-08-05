"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { PeriodSlot } from "@/lib/db";
import type { PeriodSlotOccupancy } from "@/lib/timetable/slot-overlap";
import { periodSlotDisplayLabel } from "@/lib/timetable/period-slots";

export { matchPeriodSlotIndex } from "@/lib/timetable/period-slots";

type PeriodSlotChipsProps = {
  slots: PeriodSlot[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
  /** Optional error under the chips. */
  error?: string | null;
  /** Free vs taken for the probe day (Add / Edit / Move). */
  occupancy?: PeriodSlotOccupancy[] | null;
  /** Brief message when user taps a taken chip. */
  onTakenSelect?: (info: PeriodSlotOccupancy) => void;
};

/**
 * Settings → Daily periods chips only — no custom time inputs.
 * Taken slots are grayed with subject name; hover title lists class(es).
 * Labels are always Slot 1…N by index (times are the source of truth).
 */
export function PeriodSlotChips({
  slots,
  selectedIndex,
  onSelect,
  disabled,
  error,
  occupancy,
  onTakenSelect,
}: PeriodSlotChipsProps) {
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  function flashTaken(info: PeriodSlotOccupancy) {
    const msg =
      info.occupants.length > 0
        ? `Already going on — ${info.tooltip}`
        : "That period is already taken.";
    setHint(msg);
    onTakenSelect?.(info);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 2200);
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-mute">Period</p>
      <div className="flex flex-wrap gap-1.5">
        {slots.map((slot, index) => {
          const active = selectedIndex === index;
          const info = occupancy?.find((o) => o.index === index);
          const taken = Boolean(info?.taken);
          const title = info?.tooltip ?? undefined;
          const label = periodSlotDisplayLabel(index);

          return (
            <button
              key={`${slot.startTime}-${slot.endTime}-${index}`}
              type="button"
              disabled={disabled}
              title={title}
              aria-disabled={taken || undefined}
              aria-label={
                taken && info?.takenLabel
                  ? `${label} ${slot.startTime}–${slot.endTime}, ${info.takenLabel}`
                  : `${label} ${slot.startTime}–${slot.endTime}${title ? `, ${title}` : ""}`
              }
              onClick={() => {
                if (taken && info) {
                  flashTaken(info);
                  return;
                }
                setHint(null);
                onSelect(index);
              }}
              className={cn(
                "min-h-11 max-w-[11rem] rounded-xl px-3 py-1.5 text-left transition disabled:opacity-40",
                taken && !active
                  ? "cursor-not-allowed bg-mist/80 text-mute ring-1 ring-line opacity-70"
                  : active
                    ? "bg-brand text-white"
                    : "bg-surface text-ink ring-1 ring-line",
              )}
            >
              <span className="block text-sm font-semibold">{label}</span>
              <span
                className={cn(
                  "block text-[0.7rem] tabular-nums",
                  active && !taken ? "text-white/85" : "text-mute",
                )}
              >
                {slot.startTime}–{slot.endTime}
              </span>
              {taken && info?.takenLabel ? (
                <span
                  className={cn(
                    "mt-0.5 block truncate text-[0.65rem] font-medium leading-tight",
                    active ? "text-white/90" : "text-risk-danger",
                  )}
                >
                  {info.takenLabel}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[0.7rem] text-mute">
        {selectedIndex == null
          ? "No matching period — pick a free chip, or add this time in Settings → Daily periods."
          : "Gray chips are taken that day. Hover (or hold) a chip to see which class. Times from Settings → Daily periods."}
      </p>
      {hint ? (
        <p role="status" className="mt-2 text-sm text-risk-danger">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-risk-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
