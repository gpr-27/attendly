"use client";

import type { Subject, TimetableSeries } from "@/lib/db";

type SlotListProps = {
  slots: TimetableSeries[];
  subjectById: Map<string, Subject>;
  dayLabel: string;
  busy?: boolean;
  onEdit?: (slot: TimetableSeries) => void;
  onDelete?: (slot: TimetableSeries) => void;
  onAddClass?: () => void;
  /** Focused bunk/risk insight for this subject. */
  onInsight?: (slot: TimetableSeries) => void;
};

export function SlotList({
  slots,
  subjectById,
  dayLabel,
  busy,
  onEdit,
  onDelete,
  onAddClass,
  onInsight,
}: SlotListProps) {
  if (slots.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center">
        <p className="font-display text-lg text-ink">
          No weekly class on {dayLabel}
        </p>
        <p className="mt-1 text-sm text-mute">
          Add a slot here to put it on every {dayLabel} going forward.
        </p>
        {onAddClass ? (
          <button
            type="button"
            onClick={onAddClass}
            className="mt-4 min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white"
          >
            Add to permanent timetable
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-2.5">
      {slots.map((slot) => {
        const id = String(slot.id);
        const subject = subjectById.get(String(slot.subjectId));
        const color = subject?.color ?? "#0f6e6a";

        return (
          <li
            key={id}
            className="overflow-hidden rounded-xl bg-surface ring-1 ring-line"
          >
            <div className="flex items-stretch">
              <span
                className="w-1.5 shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    <span
                      className="inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-xs font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {subject?.name ?? "Unknown subject"}
                    </span>
                    {subject?.shortCode &&
                    subject.shortCode.toLowerCase() !==
                      subject.name.toLowerCase() ? (
                      <span className="font-normal text-mute">
                        {subject.shortCode}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-mute">
                    {slot.startTime} – {slot.endTime}
                    {slot.location ? ` · ${slot.location}` : ""}
                    {slot.sessionType ? ` · ${slot.sessionType}` : ""}
                    {slot.weekParity && slot.weekParity !== "all"
                      ? ` · ${slot.weekParity} weeks`
                      : ""}
                  </p>
                  <p className="mt-1 text-[0.7rem] font-medium text-brand">
                    Every {dayLabel} · permanent schedule
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {onInsight ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="min-h-9 rounded-xl px-3 text-xs font-semibold text-brand ring-1 ring-brand/30 disabled:opacity-40"
                      onClick={() => onInsight(slot)}
                    >
                      Insights
                    </button>
                  ) : null}
                  {onEdit ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="min-h-9 rounded-xl px-3 text-xs font-semibold text-ink-soft ring-1 ring-line disabled:opacity-40"
                      onClick={() => onEdit(slot)}
                    >
                      Edit permanent
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="min-h-9 rounded-xl px-3 text-xs font-semibold text-risk-danger ring-1 ring-risk-danger/30 disabled:opacity-40"
                      onClick={() => onDelete(slot)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
