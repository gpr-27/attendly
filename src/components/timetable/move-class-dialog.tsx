"use client";

import { useEffect, useState } from "react";
import { defaultPeriodSlots, type PeriodSlot } from "@/lib/db";
import type { MoveSessionScope } from "@/lib/timetable";
import {
  MutationScopeRadios,
  type ClassMutationScope,
} from "@/components/timetable/mutation-scope-radios";
import { PeriodSlotChips } from "@/components/timetable/period-slot-chips";
import { usePeriodOccupancy } from "@/components/timetable/use-period-occupancy";
import { resolvePeriodChipsForTimes } from "@/lib/timetable/period-slots";

type MoveClassDialogProps = {
  open: boolean;
  subjectLabel: string;
  /** YYYY-MM-DD */
  initialDate: string;
  initialStart: string;
  initialEnd: string;
  initialLocation?: string;
  /** Session id being moved — excluded from overlap checks. */
  sessionId?: string;
  /** Show permanent weekly option (series occurrences only). */
  allowPermanent?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (input: {
    newDate: string;
    startTime: string;
    endTime: string;
    location?: string;
    scope: MoveSessionScope;
  }) => Promise<void>;
};

/**
 * Reschedule — period chips only + exactly two scopes.
 * Blocks overlapping another class on the target day/slot.
 */
export function MoveClassDialog({
  open,
  subjectLabel,
  initialDate,
  initialStart,
  initialEnd,
  initialLocation,
  sessionId,
  allowPermanent = false,
  busy,
  onClose,
  onConfirm,
}: MoveClassDialogProps) {
  const [date, setDate] = useState(initialDate);
  const [location, setLocation] = useState(initialLocation ?? "");
  const [scope, setScope] = useState<ClassMutationScope>("this_date");
  const [error, setError] = useState<string | null>(null);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>(
    defaultPeriodSlots(),
  );
  const [slotIndex, setSlotIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(initialDate);
    setLocation(initialLocation ?? "");
    setScope("this_date");
    setError(null);
    void (async () => {
      try {
        const { slots, selectedIndex } = await resolvePeriodChipsForTimes(
          initialStart,
          initialEnd,
        );
        setPeriodSlots(slots);
        setSlotIndex(selectedIndex);
      } catch {
        setPeriodSlots(defaultPeriodSlots());
        setSlotIndex(null);
      }
    })();
  }, [open, initialDate, initialStart, initialEnd, initialLocation]);

  const occupancy = usePeriodOccupancy({
    enabled: open,
    date,
    slots: periodSlots,
    excludeSessionId: sessionId,
  });

  useEffect(() => {
    if (!occupancy || slotIndex == null) return;
    const info = occupancy.find((o) => o.index === slotIndex);
    if (info?.taken) setSlotIndex(null);
  }, [occupancy, slotIndex]);

  if (!open) return null;

  const selected =
    slotIndex != null && slotIndex >= 0 ? periodSlots[slotIndex] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-class-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface-raised p-5 shadow-xl ring-1 ring-line safe-area-pb sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
          Reschedule
        </p>
        <h2
          id="move-class-title"
          className="font-display mt-1 text-xl font-semibold text-ink"
        >
          Move this class to…
        </h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          {subjectLabel} — pick a day and period slot.
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
              const { findDaySlotOverlaps } = await import(
                "@/lib/timetable/slot-overlap"
              );
              const overlap = await findDaySlotOverlaps({
                date,
                startTime: selected.startTime,
                endTime: selected.endTime,
                excludeSessionId: sessionId,
              });
              if (!overlap.ok) {
                setError(overlap.message);
                return;
              }
              await onConfirm({
                newDate: date,
                startTime: selected.startTime,
                endTime: selected.endTime,
                location: location.trim() || undefined,
                scope: allowPermanent ? scope : "this_date",
              });
            })().catch((err: unknown) => {
              setError(
                err instanceof Error ? err.message : "Could not move class",
              );
            });
          }}
        >
          <label className="block text-xs font-medium text-mute">
            Date
            <input
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setError(null);
              }}
            />
          </label>

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

          <MutationScopeRadios
            name="move-scope"
            value={allowPermanent ? scope : "this_date"}
            onChange={setScope}
            allowPermanent={allowPermanent}
          />

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
              {allowPermanent && scope === "entire_pattern"
                ? "Update every week"
                : "Move this date only"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
