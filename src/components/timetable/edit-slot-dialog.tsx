"use client";

import { useEffect, useState } from "react";
import type { PeriodSlot, Subject, TimetableSeries } from "@/lib/db";
import { defaultPeriodSlots } from "@/lib/db";
import type { EditSeriesScope } from "@/lib/timetable";
import {
  MutationScopeRadios,
  type ClassMutationScope,
} from "@/components/timetable/mutation-scope-radios";
import { PeriodSlotChips } from "@/components/timetable/period-slot-chips";
import { usePeriodOccupancy } from "@/components/timetable/use-period-occupancy";
import { resolvePeriodChipsForTimes } from "@/lib/timetable/period-slots";

export type EditSlotMode = "master" | "occurrence";

type EditSlotDialogProps = {
  open: boolean;
  slot: TimetableSeries | null;
  subject?: Subject;
  mode: EditSlotMode;
  date: string;
  busy?: boolean;
  onClose: () => void;
  onSave: (input: {
    patch: { startTime: string; endTime: string; location?: string };
    scope: EditSeriesScope;
    date: string;
  }) => Promise<void>;
};

/** Edit class — period chips only; two scopes on week occurrences. */
export function EditSlotDialog({
  open,
  slot,
  subject,
  mode,
  date,
  busy,
  onClose,
  onSave,
}: EditSlotDialogProps) {
  const [location, setLocation] = useState("");
  const [scope, setScope] = useState<ClassMutationScope>("this_date");
  const [localDate, setLocalDate] = useState(date);
  const [error, setError] = useState<string | null>(null);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>(
    defaultPeriodSlots(),
  );
  const [slotIndex, setSlotIndex] = useState<number | null>(null);
  const [probeDate, setProbeDate] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !slot) return;
    setLocation(slot.location ?? "");
    setScope(mode === "master" ? "entire_pattern" : "this_date");
    setLocalDate(date);
    setError(null);
    void (async () => {
      try {
        const { slots, selectedIndex } = await resolvePeriodChipsForTimes(
          slot.startTime,
          slot.endTime,
        );
        setPeriodSlots(slots);
        setSlotIndex(selectedIndex);
      } catch {
        setPeriodSlots(defaultPeriodSlots());
        setSlotIndex(null);
      }
    })();
  }, [open, slot, mode, date]);

  useEffect(() => {
    if (!open || !slot) {
      setProbeDate(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      if (mode === "occurrence") {
        if (!cancelled) setProbeDate(localDate);
        return;
      }
      const { probeDateForWeekday } = await import(
        "@/lib/timetable/slot-overlap"
      );
      const ymd = await probeDateForWeekday(slot.dayOfWeek);
      if (!cancelled) setProbeDate(ymd);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, slot, mode, localDate]);

  const occupancy = usePeriodOccupancy({
    enabled: open && Boolean(slot),
    date: probeDate,
    slots: periodSlots,
    excludeSeriesId: slot ? String(slot.id) : null,
  });

  useEffect(() => {
    if (!occupancy || slotIndex == null) return;
    const info = occupancy.find((o) => o.index === slotIndex);
    if (info?.taken) setSlotIndex(null);
  }, [occupancy, slotIndex]);

  if (!open || !slot) return null;

  const selected =
    slotIndex != null && slotIndex >= 0 ? periodSlots[slotIndex] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-slot-title"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface-raised p-5 shadow-xl ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
          {mode === "master"
            ? "Original / permanent timetable"
            : "Change class"}
        </p>
        <h2
          id="edit-slot-title"
          className="font-display mt-1 text-xl font-semibold text-ink"
        >
          Edit {subject?.name?.trim() || subject?.shortCode || "class"}
        </h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          {mode === "master"
            ? "Saving updates every week — your permanent repeating schedule."
            : "Choose this date only or every week."}
        </p>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selected) {
              setError("Pick a period slot.");
              return;
            }
            setError(null);
            void (async () => {
              const checkDate =
                mode === "occurrence" ? localDate : probeDate || date;
              const { findDaySlotOverlaps } = await import(
                "@/lib/timetable/slot-overlap"
              );
              const overlap = await findDaySlotOverlaps({
                date: checkDate || localDate,
                startTime: selected.startTime,
                endTime: selected.endTime,
                excludeSeriesId: String(slot.id),
              });
              if (!overlap.ok) {
                setError(overlap.message);
                return;
              }
              await onSave({
                patch: {
                  startTime: selected.startTime,
                  endTime: selected.endTime,
                  location: location.trim() || undefined,
                },
                scope: mode === "master" ? "entire_pattern" : scope,
                date: localDate,
              });
            })().catch((err: unknown) => {
              setError(
                err instanceof Error ? err.message : "Could not save",
              );
            });
          }}
        >
          {mode === "occurrence" ? (
            <label className="block text-xs font-medium text-mute">
              Date
              <input
                type="date"
                required
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                value={localDate}
                onChange={(e) => setLocalDate(e.target.value)}
              />
            </label>
          ) : null}

          <PeriodSlotChips
            slots={periodSlots}
            selectedIndex={slotIndex}
            occupancy={occupancy}
            onSelect={(i) => {
              setSlotIndex(i);
              setError(null);
            }}
          />

          <label className="block text-xs font-medium text-mute">
            Room (optional)
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="LH-1"
            />
          </label>

          {mode === "occurrence" ? (
            <MutationScopeRadios
              name="edit-scope"
              value={scope}
              onChange={setScope}
            />
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-risk-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="min-h-11 rounded-xl px-4 text-sm font-semibold text-ink-soft ring-1 ring-line disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={busy || slotIndex == null}
              className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {mode === "master" || scope === "entire_pattern"
                ? "Save every week"
                : "Save this date only"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
