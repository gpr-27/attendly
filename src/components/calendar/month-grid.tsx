"use client";

import { format } from "date-fns";
import { cn } from "@/lib/cn";
import type { DayStatus } from "@/components/calendar/calendar-page";

const DOT: Record<DayStatus, string> = {
  none: "bg-transparent",
  present: "bg-risk-safe",
  absent: "bg-risk-danger",
  mixed: "bg-risk-watch",
  on_duty: "bg-risk-watch",
  cancelled: "bg-mute",
  holiday: "bg-mute",
};

type MonthGridProps = {
  days: Date[];
  cursor: Date;
  selectedYmd: string;
  statusByDay: Map<string, DayStatus>;
  isSameMonth: (a: Date, b: Date) => boolean;
  onSelectDay: (ymd: string) => void;
};

export function MonthGrid({
  days,
  cursor,
  selectedYmd,
  statusByDay,
  isSameMonth,
  onSelectDay,
}: MonthGridProps) {
  const todayYmd = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="rise rise-delay-2">
      <div className="mb-2 grid grid-cols-7 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-mute">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 rounded-[var(--radius)] bg-surface-raised p-2 ring-1 ring-line">
        {days.map((day) => {
          const ymd = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, cursor);
          const status = statusByDay.get(ymd) ?? "none";
          const isToday = ymd === todayYmd;
          const selected = ymd === selectedYmd;

          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onSelectDay(ymd)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl py-1.5 transition hover:bg-mist/80",
                !inMonth && "opacity-30",
                selected && "bg-brand/10 ring-1 ring-brand/40",
              )}
              aria-label={`Select ${ymd}`}
              aria-pressed={selected}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm tabular-nums",
                  isToday && !selected && "bg-brand font-semibold text-white",
                  selected && "bg-brand font-semibold text-white",
                  !isToday && !selected && "text-ink",
                )}
              >
                {format(day, "d")}
              </span>
              <span
                className={cn("size-1.5 rounded-full", DOT[status])}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
      {statusByDay.size === 0 ? (
        <p className="mt-4 text-center text-sm text-mute">
          No session marks yet — dots appear after you mark classes.
        </p>
      ) : null}
    </div>
  );
}
