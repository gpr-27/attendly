"use client";

import { cn } from "@/lib/utils/cn";
import type { MarkStatus } from "@/lib/today-types";

const ACTIONS: {
  status: Exclude<MarkStatus, "unmarked">;
  label: string;
  short: string;
  selectedClass: string;
  idleClass: string;
}[] = [
  {
    status: "present",
    label: "Present",
    short: "P",
    selectedClass: "bg-risk-safe text-white ring-2 ring-risk-safe/40",
    idleClass:
      "bg-risk-safe/15 text-risk-safe ring-1 ring-risk-safe/25 hover:bg-risk-safe/25",
  },
  {
    status: "absent",
    label: "Absent",
    short: "A",
    selectedClass: "bg-risk-danger text-white ring-2 ring-risk-danger/40",
    idleClass:
      "bg-risk-danger/15 text-risk-danger ring-1 ring-risk-danger/25 hover:bg-risk-danger/25",
  },
  {
    status: "cancelled",
    label: "Cancelled",
    short: "C",
    selectedClass: "bg-ink-soft text-white ring-2 ring-ink-soft/40",
    idleClass:
      "bg-mist text-ink-soft ring-1 ring-line hover:bg-mist/80",
  },
  {
    status: "holiday",
    label: "Holiday",
    short: "H",
    selectedClass: "bg-brand text-white ring-2 ring-brand/40",
    idleClass:
      "bg-brand/10 text-brand ring-1 ring-brand/25 hover:bg-brand/15",
  },
  {
    status: "on_duty",
    label: "On Duty",
    short: "OD",
    selectedClass: "bg-brand-deep text-white ring-2 ring-brand/40",
    idleClass:
      "bg-mist text-brand-deep ring-1 ring-brand/30 hover:bg-brand/10",
  },
];

type MarkActionsProps = {
  current: MarkStatus;
  onMark: (status: Exclude<MarkStatus, "unmarked">) => void;
  onUndo?: () => void;
  disabled?: boolean;
};

/** Compact horizontal P / A / C / H / OD mark controls. */
export function MarkActions({
  current,
  onMark,
  onUndo,
  disabled,
}: MarkActionsProps) {
  const marked = current !== "unmarked";

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Mark attendance"
      >
        {ACTIONS.map((action) => {
          const selected = current === action.status;
          return (
            <button
              key={action.status}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={action.label}
              title={action.label}
              onClick={() => onMark(action.status)}
              className={cn(
                "inline-flex min-h-9 min-w-[2.5rem] flex-1 items-center justify-center rounded-lg px-2 text-sm font-semibold tabular-nums transition sm:flex-none sm:min-w-[2.75rem]",
                selected ? action.selectedClass : action.idleClass,
                selected && "scale-[1.02] shadow-sm",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              {action.short}
            </button>
          );
        })}
      </div>
      {marked && onUndo ? (
        <button
          type="button"
          onClick={onUndo}
          className="text-xs font-medium text-mute underline-offset-2 hover:text-ink hover:underline"
        >
          Undo mark
        </button>
      ) : null}
    </div>
  );
}
