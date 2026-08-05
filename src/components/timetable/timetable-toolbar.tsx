"use client";

import { useState } from "react";

const COPY_TARGETS = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
] as const;

type TimetableToolbarProps = {
  busy: boolean;
  hasSlots: boolean;
  currentDay: number;
  onAdd: () => void;
  onCopyDay: (targetDays: number[]) => Promise<void>;
  onExportIcs: () => Promise<void>;
};

/** Day actions — Add opens scope (This date / Every week); Copy/Export use pattern. */
export function TimetableToolbar({
  busy,
  hasSlots,
  currentDay,
  onAdd,
  onCopyDay,
  onExportIcs,
}: TimetableToolbarProps) {
  const [showCopy, setShowCopy] = useState(false);
  const [copyDays, setCopyDays] = useState<number[]>([]);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white"
        >
          Add class
        </button>
        <button
          type="button"
          disabled={!hasSlots || busy}
          onClick={() => setShowCopy((v) => !v)}
          className="min-h-10 rounded-xl px-4 text-sm font-medium text-ink-soft ring-1 ring-line disabled:opacity-40"
        >
          Copy day
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onExportIcs()}
          className="min-h-10 rounded-xl px-4 text-sm font-medium text-ink-soft ring-1 ring-line disabled:opacity-40"
        >
          Export .ics
        </button>
      </div>

      {showCopy ? (
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-xs font-medium text-mute">
            Copy this day&apos;s weekly slots onto other weekdays (master
            pattern)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COPY_TARGETS.filter((t) => t.day !== currentDay).map((t) => {
              const on = copyDays.includes(t.day);
              return (
                <button
                  key={t.day}
                  type="button"
                  onClick={() =>
                    setCopyDays((prev) =>
                      on ? prev.filter((d) => d !== t.day) : [...prev, t.day],
                    )
                  }
                  className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${
                    on
                      ? "bg-brand text-white"
                      : "bg-surface-raised text-ink-soft ring-1 ring-line"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={busy || copyDays.length === 0}
            className="mt-3 min-h-10 w-full rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => {
              void onCopyDay(copyDays).then(() => {
                setShowCopy(false);
                setCopyDays([]);
              });
            }}
          >
            Copy into pattern
          </button>
        </div>
      ) : null}
    </div>
  );
}
