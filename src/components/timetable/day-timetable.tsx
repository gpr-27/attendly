"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ClassSession, Subject, TimetableSeries } from "@/lib/db";
import {
  addDaysYmd,
  dayOfWeekFromYmd,
  formatDayLabel,
  todayYmd,
} from "@/lib/dates";
import { cn } from "@/lib/cn";
import {
  subjectPrimaryLabel,
  subjectSecondaryCode,
} from "@/lib/subject-label";
import { TimetableToolbar } from "@/components/timetable/timetable-toolbar";
import { isRemovableExtraSession } from "@/lib/timetable";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function badgeFor(session: ClassSession): {
  label: string;
  tone: "pattern" | "exception" | "extra";
} {
  if (
    session.source === "exception_modified" ||
    session.status === "cancelled"
  ) {
    return { label: "One-day change", tone: "exception" };
  }
  if (
    session.source === "extra" ||
    session.source === "one_off" ||
    session.source === "substitution" ||
    session.relevance === "makeup" ||
    session.relevance === "additional" ||
    session.relevance === "substitution"
  ) {
    return { label: "Extra / makeup", tone: "extra" };
  }
  return { label: "From weekly pattern", tone: "pattern" };
}

function localHm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export type DayTimetableProps = {
  selectedYmd: string;
  onSelectedYmdChange: (ymd: string) => void;
  sessions: ClassSession[];
  subjectById: Map<string, Subject>;
  seriesById: Map<string, TimetableSeries>;
  busy?: boolean;
  loading?: boolean;
  /** Permanent weekly slots exist — empty days often mean semester bounds. */
  hasWeeklyPattern?: boolean;
  semesterStart?: string;
  semesterEnd?: string;
  /** Permanent pattern slots for this weekday (for Copy day). */
  patternSlotCount: number;
  onAddClass: () => void;
  onCopyDay: (targetDays: number[]) => Promise<void>;
  onExportIcs: () => Promise<void>;
  onEditOccurrence: (series: TimetableSeries, date: string) => void;
  onCancelOccurrence: (series: TimetableSeries, date: string) => void;
  onMoveOccurrence: (session: ClassSession, date: string) => void;
  onDeleteCancelled: (session: ClassSession) => void;
  onRemoveExtra: (session: ClassSession) => void;
  onInsight: (session: ClassSession, date: string) => void;
};

/**
 * Single Timetable surface: pick any calendar day, see that day’s classes,
 * and edit with This date only / Every week (permanent) scopes.
 */
export function DayTimetable({
  selectedYmd,
  onSelectedYmdChange,
  sessions,
  subjectById,
  seriesById,
  busy,
  loading,
  hasWeeklyPattern,
  semesterStart,
  semesterEnd,
  patternSlotCount,
  onAddClass,
  onCopyDay,
  onExportIcs,
  onEditOccurrence,
  onCancelOccurrence,
  onMoveOccurrence,
  onDeleteCancelled,
  onRemoveExtra,
  onInsight,
}: DayTimetableProps) {
  const today = todayYmd();
  const dow = dayOfWeekFromYmd(selectedYmd);
  const dayLabel = DAY_LABELS[dow] ?? "—";
  const isToday = selectedYmd === today;
  const outsideSemester = Boolean(
    (semesterStart && selectedYmd < semesterStart) ||
      (semesterEnd && selectedYmd > semesterEnd),
  );

  function stepDay(delta: number) {
    const next = addDaysYmd(selectedYmd, delta);
    if (semesterStart && semesterEnd) {
      if (next < semesterStart) {
        onSelectedYmdChange(semesterEnd);
        return;
      }
      if (next > semesterEnd) {
        onSelectedYmdChange(semesterStart);
        return;
      }
    }
    onSelectedYmdChange(next);
  }

  return (
    <section
      id="timetable-day"
      className="rise rounded-2xl border border-brand/25 bg-mist/40 p-4 sm:p-5"
    >
      <header className="mb-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
          Timetable
        </p>
        <h2 className="font-display mt-1 text-xl font-semibold text-ink">
          {formatDayLabel(selectedYmd)}
          {isToday ? (
            <span className="ml-2 text-sm font-semibold text-brand">Today</span>
          ) : null}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          <span className="font-medium text-ink">
            {dayLabel} · permanent pattern
          </span>
          {" — "}
          pick any date. Edits ask{" "}
          <strong className="font-semibold text-ink">This date only</strong> or{" "}
          <strong className="font-semibold text-ink">
            Every week (permanent)
          </strong>
          .
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft ring-1 ring-line hover:bg-surface hover:text-ink"
          aria-label="Previous day"
          onClick={() => stepDay(-1)}
        >
          <ChevronLeft className="size-5" />
        </button>
        <label className="inline-flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line sm:flex-none">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-mute">
            Date
          </span>
          <input
            type="date"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink"
            value={selectedYmd}
            min={semesterStart || undefined}
            max={semesterEnd || undefined}
            onChange={(e) => {
              if (e.target.value) onSelectedYmdChange(e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft ring-1 ring-line hover:bg-surface hover:text-ink"
          aria-label="Next day"
          onClick={() => stepDay(1)}
        >
          <ChevronRight className="size-5" />
        </button>
        {!isToday ? (
          <button
            type="button"
            className="min-h-11 rounded-full px-4 text-xs font-semibold text-brand ring-1 ring-brand/30"
            onClick={() => onSelectedYmdChange(today)}
          >
            Jump to today
          </button>
        ) : null}
      </div>

      <TimetableToolbar
        busy={Boolean(busy)}
        hasSlots={patternSlotCount > 0}
        onAdd={onAddClass}
        onCopyDay={onCopyDay}
        onExportIcs={onExportIcs}
        currentDay={dow}
      />

      {outsideSemester && !loading ? (
        <p className="mt-4 rounded-xl bg-surface px-3 py-2.5 text-sm text-ink-soft ring-1 ring-line/70">
          This date is outside your semester
          {semesterStart && semesterEnd
            ? ` (${semesterStart} → ${semesterEnd})`
            : ""}
          . Classes only materialize inside the teaching range — set it in{" "}
          <Link
            href="/settings"
            className="font-semibold text-brand underline-offset-2 hover:underline"
          >
            Settings → semester range
          </Link>
          .
          {hasWeeklyPattern
            ? " Your weekly pattern still exists; it applies within those dates."
            : ""}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-mute">Loading…</p>
      ) : sessions.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center">
          <p className="font-display text-lg text-ink">
            No classes on {formatDayLabel(selectedYmd)}
          </p>
          <p className="mt-1 text-sm text-mute">
            {outsideSemester
              ? "Adjust the semester range, or add a one-off class for this date."
              : `Add a class for this date only, or every ${dayLabel} on the permanent pattern.`}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onAddClass}
              className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white"
            >
              Add class
            </button>
            {outsideSemester ? (
              <Link
                href="/settings"
                className="inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold text-brand ring-1 ring-brand/30"
              >
                Open Settings
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          <li className="flex items-baseline justify-between px-0.5 text-xs text-mute">
            <span>
              Viewing{" "}
              <span className="font-semibold text-ink-soft">
                {formatDayLabel(selectedYmd)}
              </span>
            </span>
            <span>
              {sessions.length} class{sessions.length === 1 ? "" : "es"}
            </span>
          </li>
          {sessions.map((session) => (
            <SessionCard
              key={String(session.id)}
              session={session}
              date={selectedYmd}
              busy={busy}
              subjectById={subjectById}
              seriesById={seriesById}
              onEditOccurrence={onEditOccurrence}
              onCancelOccurrence={onCancelOccurrence}
              onMoveOccurrence={onMoveOccurrence}
              onDeleteCancelled={onDeleteCancelled}
              onRemoveExtra={onRemoveExtra}
              onInsight={onInsight}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SessionCard({
  session,
  date,
  busy,
  subjectById,
  seriesById,
  onEditOccurrence,
  onCancelOccurrence,
  onMoveOccurrence,
  onDeleteCancelled,
  onRemoveExtra,
  onInsight,
}: {
  session: ClassSession;
  date: string;
  busy?: boolean;
  subjectById: Map<string, Subject>;
  seriesById: Map<string, TimetableSeries>;
  onEditOccurrence: (series: TimetableSeries, date: string) => void;
  onCancelOccurrence: (series: TimetableSeries, date: string) => void;
  onMoveOccurrence: (session: ClassSession, date: string) => void;
  onDeleteCancelled: (session: ClassSession) => void;
  onRemoveExtra: (session: ClassSession) => void;
  onInsight: (session: ClassSession, date: string) => void;
}) {
  const subject = subjectById.get(String(session.subjectId));
  const color = subject?.color ?? "#0f6e6a";
  const badge = badgeFor(session);
  const series = session.seriesId
    ? seriesById.get(String(session.seriesId))
    : undefined;
  const startHm = localHm(session.startsAt);
  const endHm = localHm(session.endsAt);
  const primary = subjectPrimaryLabel(subject ?? {});
  const code = subjectSecondaryCode(subject ?? {});
  const isCancelled =
    session.status === "cancelled" || session.status === "holiday";
  const isExtra = isRemovableExtraSession(session);

  return (
    <li className="overflow-hidden rounded-xl bg-surface ring-1 ring-line">
      <div className="flex items-stretch">
        <span
          className="w-1.5 shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1 px-3.5 py-3.5 sm:px-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="min-w-0 text-base font-semibold text-ink">{primary}</p>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-ink-soft">
              {startHm}–{endHm}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-mute">
            {[
              code,
              session.location,
              session.sessionType,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <span
            className={cn(
              "mt-2 inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold",
              badge.tone === "pattern" && "bg-mist text-ink-soft",
              badge.tone === "exception" && "bg-risk-watch-bg text-risk-watch",
              badge.tone === "extra" && "bg-brand/10 text-brand",
            )}
          >
            {isCancelled ? "Cancelled (one day)" : badge.label}
          </span>

          {isCancelled ? (
            <div className="mt-3">
              <button
                type="button"
                disabled={busy}
                className="min-h-9 rounded-xl px-3 text-xs font-semibold text-risk-danger ring-1 ring-risk-danger/30 disabled:opacity-40"
                onClick={() => onDeleteCancelled(session)}
              >
                Delete cancelled
              </button>
            </div>
          ) : (
            <ClassActions
              busy={busy}
              isExtra={isExtra}
              onInsight={() => onInsight(session, date)}
              onMove={() => onMoveOccurrence(session, date)}
              onEdit={
                series ? () => onEditOccurrence(series, date) : undefined
              }
              onCancel={
                series ? () => onCancelOccurrence(series, date) : undefined
              }
              onRemove={isExtra ? () => onRemoveExtra(session) : undefined}
            />
          )}
        </div>
      </div>
    </li>
  );
}

function ClassActions({
  busy,
  isExtra,
  onInsight,
  onMove,
  onEdit,
  onCancel,
  onRemove,
}: {
  busy?: boolean;
  isExtra?: boolean;
  onInsight: () => void;
  onMove: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onRemove?: () => void;
}) {
  const btn =
    "min-h-9 shrink-0 rounded-xl px-3 text-xs font-semibold disabled:opacity-40";

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy}
          className={cn(btn, "text-brand ring-1 ring-brand/30")}
          onClick={onInsight}
        >
          Insights
        </button>
        <button
          type="button"
          disabled={busy}
          className={cn(btn, "text-ink-soft ring-1 ring-line")}
          onClick={onMove}
        >
          Move
        </button>
        {onEdit ? (
          <button
            type="button"
            disabled={busy}
            className={cn(btn, "text-ink-soft ring-1 ring-line")}
            onClick={onEdit}
          >
            Change
          </button>
        ) : null}
        {onCancel ? (
          <button
            type="button"
            disabled={busy}
            className={cn(btn, "text-risk-danger ring-1 ring-risk-danger/30")}
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            disabled={busy}
            className={cn(btn, "text-risk-danger ring-1 ring-risk-danger/30")}
            onClick={onRemove}
          >
            Remove
          </button>
        ) : null}
      </div>
      <p className="text-[0.65rem] text-mute">
        {isExtra
          ? "Move applies this date only. Remove deletes this Extra / makeup."
          : "Move / Change / Cancel open scope: This date only or Every week (permanent)."}
      </p>
    </div>
  );
}
