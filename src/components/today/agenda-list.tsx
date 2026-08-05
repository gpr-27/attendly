"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { AgendaClass, MarkStatus } from "@/lib/today-types";
import { MarkActions } from "@/components/today/mark-actions";

const RISK_DOT: Record<NonNullable<AgendaClass["risk"]>, string> = {
  safe: "bg-risk-safe",
  watch: "bg-risk-watch",
  danger: "bg-risk-danger",
};

const STATUS_LABEL: Record<MarkStatus, string> = {
  unmarked: "Not marked",
  present: "Present",
  absent: "Absent",
  cancelled: "Cancelled",
  holiday: "Holiday",
  on_duty: "On Duty",
};

type AgendaListProps = {
  items: AgendaClass[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onMark: (id: string, status: Exclude<MarkStatus, "unmarked">) => void;
  onUndo: (id: string) => void;
  onMove?: (item: AgendaClass) => void;
  onDeleteCancelled?: (item: AgendaClass) => void;
  onRemoveExtra?: (item: AgendaClass) => void;
  onAskAi?: (item: AgendaClass) => void;
  askAiLabel?: string;
  emptyTitle?: string;
};

export function AgendaList({
  items,
  activeId,
  onSelect,
  onMark,
  onUndo,
  onMove,
  onDeleteCancelled,
  onRemoveExtra,
  onAskAi,
  askAiLabel = "Ask AI",
  emptyTitle = "No classes today",
}: AgendaListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface-raised/80 px-5 py-8">
        <p className="font-display text-lg text-ink">{emptyTitle}</p>
        <p className="mt-1 text-sm text-mute">
          Your timetable has no slots for this weekday — or sessions aren’t
          materialized yet. Nothing is invented here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/timetable"
            className="min-h-10 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white"
          >
            Edit timetable
          </Link>
          <Link
            href="/import"
            className="min-h-10 rounded-full border border-line bg-mist/50 px-4 py-2 text-xs font-semibold text-ink"
          >
            Import photo
          </Link>
          <Link
            href="/plan"
            className="min-h-10 rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-soft"
          >
            Plan bunks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item, index) => {
        const open = activeId === item.id;
        const done = item.status !== "unmarked";
        const isCancelled =
          item.status === "cancelled" || item.status === "holiday";
        const canMove =
          Boolean(onMove) &&
          item.status !== "cancelled" &&
          item.status !== "holiday";
        const canRemoveExtra =
          Boolean(onRemoveExtra) &&
          !isCancelled &&
          !item.seriesId;

        return (
          <li
            key={item.id}
            id={`agenda-${item.id}`}
            className={cn(
              "rise overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-card)]",
              index === 0 && "rise-delay-1",
              index === 1 && "rise-delay-2",
              index >= 2 && "rise-delay-3",
              open && "ring-2 ring-brand/40",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(open ? "" : item.id)}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: item.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold text-ink">
                    {item.subjectName}
                  </p>
                  <p className="font-display shrink-0 text-lg font-semibold tabular-nums text-ink">
                    {item.pct === null ? (
                      <span className="text-base text-mute">—</span>
                    ) : (
                      <>
                        {item.pct.toFixed(0)}
                        <span className="text-sm">%</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
                  <span>
                    {item.startLabel}–{item.endLabel}
                  </span>
                  {item.shortCode &&
                  item.shortCode !== "—" &&
                  item.shortCode.toLowerCase() !==
                    item.subjectName.toLowerCase() ? (
                    <span className="font-medium text-ink-soft">
                      {item.shortCode}
                    </span>
                  ) : null}
                  {item.location ? <span>· {item.location}</span> : null}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
                      item.status === "present" &&
                        "bg-risk-safe-bg text-risk-safe",
                      item.status === "absent" &&
                        "bg-risk-danger-bg text-risk-danger",
                      item.status === "on_duty" &&
                        "bg-risk-watch-bg text-risk-watch",
                      (item.status === "cancelled" ||
                        item.status === "holiday") &&
                        "bg-mist text-ink-soft",
                      item.status === "unmarked" && "bg-mist text-ink-soft",
                    )}
                  >
                    {item.risk ? (
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          RISK_DOT[item.risk],
                        )}
                      />
                    ) : null}
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
              </div>
              <span
                className={cn(
                  "size-5 shrink-0 rounded-full border-2",
                  done
                    ? "border-risk-safe bg-risk-safe"
                    : "border-line bg-transparent",
                )}
                aria-hidden
              />
            </button>

            {open ? (
              <div className="border-t border-line px-3.5 py-3">
                {item.impactLine ? (
                  <p className="text-sm text-ink-soft">{item.impactLine}</p>
                ) : (
                  <p className="text-sm text-mute">
                    Impact line appears after this subject has counted classes.
                  </p>
                )}
                <div className="mt-2.5">
                  <MarkActions
                    current={item.status}
                    onMark={(status) => onMark(item.id, status)}
                    onUndo={() => onUndo(item.id)}
                  />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {canMove ? (
                    <button
                      type="button"
                      onClick={() => onMove?.(item)}
                      className="text-xs font-semibold text-ink-soft hover:text-ink hover:underline"
                    >
                      Move…
                    </button>
                  ) : null}
                  {canRemoveExtra ? (
                    <button
                      type="button"
                      onClick={() => onRemoveExtra?.(item)}
                      className="text-xs font-semibold text-risk-danger hover:underline"
                    >
                      Remove Extra
                    </button>
                  ) : null}
                  {isCancelled && onDeleteCancelled ? (
                    <button
                      type="button"
                      onClick={() => onDeleteCancelled(item)}
                      className="text-xs font-semibold text-risk-danger hover:underline"
                    >
                      Delete cancelled
                    </button>
                  ) : null}
                  {onAskAi ? (
                    <button
                      type="button"
                      onClick={() => onAskAi(item)}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      {askAiLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
