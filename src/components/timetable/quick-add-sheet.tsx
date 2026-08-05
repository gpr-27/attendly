"use client";

import { useEffect, useState } from "react";
import type { PeriodSlot, Subject, WeekParity } from "@/lib/db";
import { defaultPeriodSlots } from "@/lib/db";
import { todayYmd } from "@/lib/dates";
import { AddSubjectForm } from "@/components/timetable/add-subject-form";
import {
  MutationScopeRadios,
  type ClassMutationScope,
} from "@/components/timetable/mutation-scope-radios";
import { PeriodSlotChips } from "@/components/timetable/period-slot-chips";
import { usePeriodOccupancy } from "@/components/timetable/use-period-occupancy";
import { cn } from "@/lib/cn";

const DAY_OPTIONS = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 0, label: "Sun" },
] as const;

const PARITY_OPTIONS: { value: WeekParity; label: string }[] = [
  { value: "all", label: "Every week" },
  { value: "odd", label: "Odd weeks" },
  { value: "even", label: "Even weeks" },
];

export type QuickAddPayload = {
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string;
  weekParity: WeekParity;
  /** 0-based Settings.periodSlots index — required. */
  slotIndex: number;
  /** This date only (extra) vs every week (permanent series). */
  scope: ClassMutationScope;
  /** YYYY-MM-DD when scope is this_date. */
  date?: string;
};

type QuickAddSheetProps = {
  open: boolean;
  subjects: Subject[];
  busy: boolean;
  defaultDay: number;
  /** Optional default date for this-date adds. */
  defaultDate?: string;
  nextColor: string;
  onClose: () => void;
  onCreateSubject: (input: {
    name: string;
    shortCode: string;
    color: string;
  }) => Promise<Subject>;
  onSaveSlot: (input: QuickAddPayload) => Promise<void>;
};

export function QuickAddSheet({
  open,
  subjects,
  busy,
  defaultDay,
  defaultDate,
  nextColor,
  onClose,
  onCreateSubject,
  onSaveSlot,
}: QuickAddSheetProps) {
  const [subjectId, setSubjectId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(defaultDay);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>(
    defaultPeriodSlots(),
  );
  const [slotIndex, setSlotIndex] = useState<number | null>(0);
  const [location, setLocation] = useState("");
  const [weekParity, setWeekParity] = useState<WeekParity>("all");
  const [scope, setScope] = useState<ClassMutationScope>("entire_pattern");
  const [date, setDate] = useState(defaultDate ?? todayYmd());
  const [showNewSubject, setShowNewSubject] = useState(subjects.length === 0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [probeDate, setProbeDate] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDayOfWeek(defaultDay);
    setShowNewSubject(subjects.length === 0);
    setLocalError(null);
    setWeekParity("all");
    setScope("entire_pattern");
    setDate(defaultDate ?? todayYmd());
    setLocation("");
    if (subjects[0]) {
      setSubjectId(String(subjects[0].id));
    } else {
      setSubjectId("");
    }
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
  }, [open, defaultDay, defaultDate, subjects]);

  useEffect(() => {
    if (!open) {
      setProbeDate(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      if (scope === "this_date") {
        if (!cancelled) setProbeDate(date);
        return;
      }
      const { probeDateForWeekday } = await import(
        "@/lib/timetable/slot-overlap"
      );
      const ymd = await probeDateForWeekday(dayOfWeek);
      if (!cancelled) setProbeDate(ymd);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, scope, date, dayOfWeek]);

  const occupancy = usePeriodOccupancy({
    enabled: open,
    date: probeDate,
    slots: periodSlots,
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface-raised px-4 pb-8 pt-4 shadow-xl sm:rounded-3xl sm:px-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
              Quick add
            </p>
            <h2
              id="quick-add-title"
              className="font-display mt-0.5 text-xl font-semibold text-ink"
            >
              Add class
            </h2>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-10 rounded-full px-3 text-sm font-medium text-mute ring-1 ring-line"
          >
            Close
          </button>
        </div>

        {subjects.length === 0 || showNewSubject ? (
          <div className="space-y-3">
            {subjects.length === 0 ? (
              <p className="rounded-xl bg-mist/80 px-3 py-2 text-sm text-ink-soft">
                Create a subject first — then pick day and period.
              </p>
            ) : null}
            <AddSubjectForm
              busy={busy}
              defaultColor={nextColor}
              onCancel={
                subjects.length > 0
                  ? () => setShowNewSubject(false)
                  : undefined
              }
              onSubmit={async (input) => {
                const created = await onCreateSubject(input);
                setSubjectId(String(created.id));
                setShowNewSubject(false);
              }}
            />
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!subjectId) {
                setLocalError("Pick a subject.");
                return;
              }
              if (slotIndex == null || !selected) {
                setLocalError("Pick a period slot.");
                return;
              }
              setLocalError(null);
              void (async () => {
                if (scope === "this_date") {
                  const { findDaySlotOverlaps } = await import(
                    "@/lib/timetable/slot-overlap"
                  );
                  const overlap = await findDaySlotOverlaps({
                    date,
                    startTime: selected.startTime,
                    endTime: selected.endTime,
                  });
                  if (!overlap.ok) {
                    setLocalError(overlap.message);
                    return;
                  }
                } else {
                  // Weekly: check next occurrence of this weekday in semester window
                  const { getSettings } = await import("@/lib/db");
                  const { addDaysYmd, dayOfWeekFromYmd, todayYmd: today } =
                    await import("@/lib/dates");
                  const { findDaySlotOverlaps } = await import(
                    "@/lib/timetable/slot-overlap"
                  );
                  const settings = await getSettings();
                  let probe =
                    settings.semesterStart?.trim() || today();
                  if (probe < today()) probe = today();
                  for (let i = 0; i < 14; i += 1) {
                    const ymd = addDaysYmd(probe, i);
                    if (dayOfWeekFromYmd(ymd) !== dayOfWeek) continue;
                    const overlap = await findDaySlotOverlaps({
                      date: ymd,
                      startTime: selected.startTime,
                      endTime: selected.endTime,
                    });
                    if (!overlap.ok) {
                      setLocalError(
                        `${overlap.message} (on ${ymd} — same period as an existing class).`,
                      );
                      return;
                    }
                    break;
                  }
                }
                await onSaveSlot({
                  subjectId,
                  dayOfWeek,
                  startTime: selected.startTime,
                  endTime: selected.endTime,
                  location: location.trim() || undefined,
                  weekParity: scope === "entire_pattern" ? weekParity : "all",
                  slotIndex,
                  scope,
                  date: scope === "this_date" ? date : undefined,
                });
              })().catch((err: unknown) => {
                setLocalError(
                  err instanceof Error ? err.message : "Could not save",
                );
              });
            }}
          >
            <MutationScopeRadios
              name="add-scope"
              legend="Add as…"
              value={scope}
              onChange={setScope}
            />

            {scope === "this_date" ? (
              <label className="block text-xs font-medium text-mute">
                Date
                <input
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-sm text-ink"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            ) : null}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-mute">Subject</p>
                <button
                  type="button"
                  onClick={() => setShowNewSubject(true)}
                  className="text-xs font-semibold text-brand"
                >
                  + New subject
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => {
                  const id = String(s.id);
                  const selectedSub = id === subjectId;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSubjectId(id)}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold ring-1 transition",
                        selectedSub
                          ? "bg-brand text-white ring-brand"
                          : "bg-surface-raised text-ink ring-line",
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      <span className="truncate">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {scope === "entire_pattern" ? (
              <div>
                <p className="mb-2 text-xs font-medium text-mute">Day</p>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_OPTIONS.map((d) => {
                    const active = dayOfWeek === d.day;
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => setDayOfWeek(d.day)}
                        className={cn(
                          "min-h-11 min-w-11 rounded-full px-3 text-sm font-semibold",
                          active
                            ? "bg-brand text-white"
                            : "bg-surface-raised text-ink-soft ring-1 ring-line",
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <PeriodSlotChips
              slots={periodSlots}
              selectedIndex={slotIndex}
              occupancy={occupancy}
              onSelect={(i) => {
                setSlotIndex(i);
                setLocalError(null);
              }}
            />

            <label className="block text-xs font-medium text-mute">
              Room (optional)
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-sm text-ink"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lab 2"
              />
            </label>

            {scope === "entire_pattern" ? (
              <div>
                <p className="mb-2 text-xs font-medium text-mute">
                  Week pattern
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PARITY_OPTIONS.map((opt) => {
                    const active = weekParity === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setWeekParity(opt.value)}
                        className={cn(
                          "min-h-9 rounded-full px-3 text-xs font-semibold",
                          active
                            ? "bg-brand text-white"
                            : "bg-surface-raised text-ink-soft ring-1 ring-line",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {localError ? (
              <p role="alert" className="text-sm text-risk-danger">
                {localError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !subjectId || slotIndex == null}
              className="min-h-12 w-full rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy
                ? "Saving…"
                : scope === "this_date"
                  ? "Add this date only"
                  : "Add every week"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
