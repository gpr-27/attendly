"use client";

import { useEffect, useState } from "react";
import type { ClassSession, PeriodSlot, Subject } from "@/lib/db";
import { defaultPeriodSlots } from "@/lib/db";
import { PeriodSlotChips } from "@/components/timetable/period-slot-chips";
import { usePeriodOccupancy } from "@/components/timetable/use-period-occupancy";

export type MakeupCandidate = {
  session: ClassSession;
  subject?: Subject;
};

type MakeupPromptProps = {
  candidates: MakeupCandidate[];
  busy: boolean;
  onSkip: () => void;
  onAddMakeup: (input: {
    replacesSessionId: string;
    subjectId: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
  }) => Promise<void>;
};

function tomorrowYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MakeupPrompt({
  candidates,
  busy,
  onSkip,
  onAddMakeup,
}: MakeupPromptProps) {
  const first = candidates[0];
  const [sessionId, setSessionId] = useState(
    first ? String(first.session.id) : "",
  );
  const [date, setDate] = useState(tomorrowYmd());
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>(
    defaultPeriodSlots(),
  );
  const [slotIndex, setSlotIndex] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { getSettings } = await import("@/lib/db");
        const settings = await getSettings();
        const slots =
          settings.periodSlots?.length > 0
            ? settings.periodSlots
            : defaultPeriodSlots();
        setPeriodSlots(slots);
        setSlotIndex(null);
      } catch {
        setPeriodSlots(defaultPeriodSlots());
        setSlotIndex(null);
      }
    })();
  }, []);

  const occupancy = usePeriodOccupancy({
    enabled: candidates.length > 0,
    date,
    slots: periodSlots,
  });

  useEffect(() => {
    if (!occupancy || slotIndex == null) return;
    const info = occupancy.find((o) => o.index === slotIndex);
    if (info?.taken) setSlotIndex(null);
  }, [occupancy, slotIndex]);

  if (candidates.length === 0) return null;

  const selected = candidates.find((c) => String(c.session.id) === sessionId);
  const slot =
    slotIndex != null && slotIndex >= 0 ? periodSlots[slotIndex] : null;

  return (
    <div className="mt-3 space-y-3 rounded-[var(--radius)] border border-brand/30 bg-brand/5 p-4">
      <div>
        <p className="text-sm font-semibold text-ink">Add makeup?</p>
        <p className="mt-0.5 text-xs text-mute">
          Today&apos;s classes were cancelled. Link a makeup to one of them —
          pick a period slot (no custom times).
        </p>
      </div>
      <label className="block text-xs font-medium text-mute">
        Replaces
        <select
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        >
          {candidates.map(({ session, subject }) => (
            <option key={String(session.id)} value={String(session.id)}>
              {subject?.name ?? "Class"} ·{" "}
              {new Date(session.startsAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-mute">
        Date
        <input
          type="date"
          className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm"
          value={date}
          onChange={(e) => setDate(e.target.value)}
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
      {error ? (
        <p role="alert" className="text-sm text-risk-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !selected || !slot}
          className="min-h-10 flex-1 rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => {
            if (!selected || !slot) return;
            void (async () => {
              const { findDaySlotOverlaps } = await import(
                "@/lib/timetable/slot-overlap"
              );
              const overlap = await findDaySlotOverlaps({
                date,
                startTime: slot.startTime,
                endTime: slot.endTime,
              });
              if (!overlap.ok) {
                setError(overlap.message);
                return;
              }
              await onAddMakeup({
                replacesSessionId: String(selected.session.id),
                subjectId: String(selected.session.subjectId),
                date,
                startTime: slot.startTime,
                endTime: slot.endTime,
                location: selected.session.location,
              });
            })().catch((err: unknown) => {
              setError(
                err instanceof Error ? err.message : "Could not add makeup",
              );
            });
          }}
        >
          Add makeup
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="min-h-10 rounded-full px-4 text-sm font-medium text-mute ring-1 ring-line"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
