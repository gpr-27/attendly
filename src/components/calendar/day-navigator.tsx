"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysYmd, isTodayYmd, todayYmd } from "@/lib/dates";
import { cn } from "@/lib/utils/cn";

type DayNavigatorProps = {
  ymd: string;
  onChange: (ymd: string) => void;
  className?: string;
  /** Compact strip for headers. */
  compact?: boolean;
};

/**
 * Prev / next day + native date picker. Local YYYY-MM-DD only.
 */
export function DayNavigator({
  ymd,
  onChange,
  className,
  compact,
}: DayNavigatorProps) {
  const today = todayYmd();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        compact ? "gap-1.5" : "gap-2",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(addDaysYmd(ymd, -1))}
        className="inline-flex size-10 items-center justify-center rounded-full border border-line text-ink-soft transition hover:bg-mist hover:text-ink"
        aria-label="Previous day"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>

      <label className="relative inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface-raised px-3 sm:flex-none sm:min-w-[12rem]">
        <CalendarDays className="size-4 shrink-0 text-brand" aria-hidden />
        <input
          type="date"
          value={ymd}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          className="w-full min-w-0 border-0 bg-transparent text-center text-sm font-semibold text-ink outline-none"
          aria-label="Pick date"
        />
      </label>

      <button
        type="button"
        onClick={() => onChange(addDaysYmd(ymd, 1))}
        className="inline-flex size-10 items-center justify-center rounded-full border border-line text-ink-soft transition hover:bg-mist hover:text-ink"
        aria-label="Next day"
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>

      {!isTodayYmd(ymd) ? (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="rounded-full bg-brand/10 px-3 py-2 text-xs font-semibold text-brand"
        >
          Today
        </button>
      ) : null}
    </div>
  );
}
