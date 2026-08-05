"use client";

import { cn } from "@/lib/cn";

type DayChipsProps = {
  selected: number;
  onSelect: (day: number) => void;
  labels: readonly string[];
  /** Optional slot counts per day index (0–6). */
  counts?: number[];
};

export function DayChips({
  selected,
  onSelect,
  labels,
  counts,
}: DayChipsProps) {
  const today = new Date().getDay();

  return (
    <div
      className="inline-flex w-full gap-0.5 overflow-x-auto rounded-xl bg-mist/70 p-1 ring-1 ring-line/60"
      role="tablist"
      aria-label="Weekday in weekly pattern"
    >
      {labels.map((label, i) => {
        const active = selected === i;
        const isToday = i === today;
        const count = counts?.[i] ?? 0;
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            className={cn(
              "relative flex min-h-11 min-w-[2.75rem] flex-1 flex-col items-center justify-center rounded-lg px-2 text-sm font-semibold transition-colors",
              active
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-soft hover:text-ink",
              isToday && !active && "text-brand",
            )}
          >
            <span>{label}</span>
            {count > 0 ? (
              <span
                className={cn(
                  "text-[0.65rem] font-medium tabular-nums",
                  active ? "text-brand" : "text-mute",
                )}
              >
                {count}
              </span>
            ) : (
              <span className="text-[0.65rem] font-medium text-transparent">
                0
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
