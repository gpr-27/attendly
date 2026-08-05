"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  loadSubjectReport,
  subjectReportStatusLabel,
  type SubjectReport,
  type SubjectReportMarkStatus,
} from "@/lib/attendance";
import { ensureSessionsMaterialized } from "@/lib/timetable";
import { cn } from "@/lib/cn";

type SubjectReportSheetProps = {
  subjectId: string | null;
  open: boolean;
  onClose: () => void;
};

const STATUS_TONE: Record<SubjectReportMarkStatus, string> = {
  present: "bg-risk-safe-bg text-risk-safe",
  late: "bg-risk-safe-bg text-risk-safe",
  absent: "bg-risk-danger-bg text-risk-danger",
  cancelled: "bg-mist text-mute",
  holiday: "bg-mist text-mute",
  on_duty: "bg-risk-watch-bg text-risk-watch",
  excused: "bg-mist text-ink-soft",
  not_marked: "bg-mist/80 text-mute ring-1 ring-line/60",
};

const RISK_TONE = {
  Safe: "bg-risk-safe-bg text-risk-safe",
  Warning: "bg-risk-watch-bg text-risk-watch",
  Critical: "bg-risk-danger-bg text-risk-danger",
} as const;

/**
 * Modal/sheet: subject standing header + week-grouped schedule with mark status.
 * Opens from Coach rule cards (and Subjects card tap).
 */
export function SubjectReportSheet({
  subjectId,
  open,
  onClose,
}: SubjectReportSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [report, setReport] = useState<SubjectReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !subjectId) {
      setReport(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        try {
          await ensureSessionsMaterialized();
        } catch {
          /* best-effort */
        }
        const next = await loadSubjectReport(subjectId);
        if (cancelled) return;
        if (!next) {
          setError("Subject not found.");
          setReport(null);
        } else {
          setReport(next);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load report");
        setReport(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, subjectId]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pct =
    report?.standing.percentage == null
      ? "—"
      : `${report.standing.percentage.toFixed(1)}%`;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-labelledby="subject-report-title">
      <button
        type="button"
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        aria-label="Close subject report"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-xl safe-area-pb sm:inset-x-3 sm:bottom-auto sm:top-[8%] sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:rounded-2xl">
        <div className="shrink-0 border-b border-line px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
                Subject report
              </p>
              <h2
                id="subject-report-title"
                className="font-display mt-0.5 text-lg font-semibold leading-snug text-ink sm:text-xl"
              >
                {report?.name ?? (loading ? "Loading…" : "Subject")}
              </h2>
              {report?.shortCode &&
              report.shortCode.toLowerCase() !== report.name.toLowerCase() ? (
                <p className="truncate text-sm text-mute">{report.shortCode}</p>
              ) : null}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-mute hover:bg-mist hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          {report ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-display text-2xl font-semibold tabular-nums text-ink">
                  {pct}
                </span>
                <span className="text-sm text-mute">
                  vs {report.standing.effectiveTargetPct}% target
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                    RISK_TONE[report.standing.risk],
                  )}
                >
                  {report.standing.risk}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-snug text-ink-soft">
                {report.bunkLine}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <SummaryStat label="Present" value={report.summary.present} />
                <SummaryStat label="Absent" value={report.summary.absent} />
                <SummaryStat label="OD" value={report.summary.onDuty} />
                <SummaryStat
                  label="Left"
                  value={report.summary.remaining}
                  className="col-span-3 sm:col-span-1"
                />
              </dl>
            </>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-sm text-mute">Loading schedule…</p>
          ) : error ? (
            <p className="rounded-xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
              {error}
            </p>
          ) : report && report.weeks.length === 0 ? (
            <p className="rounded-xl bg-mist/70 px-3 py-3 text-sm text-ink-soft">
              No classes materialized for this subject in the semester range.
              Check Timetable and Settings → Semester range.
            </p>
          ) : report ? (
            <div className="space-y-4">
              {report.weeks.map((week) => (
                <section key={week.weekStartYmd}>
                  <h3 className="sticky top-0 z-[1] -mx-1 bg-surface/95 px-1 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-mute backdrop-blur-sm">
                    Week of {week.weekLabel.split(" – ")[0]}
                  </h3>
                  <ul className="mt-1.5 space-y-1.5">
                    {week.sessions.map((row) => (
                      <li
                        key={row.sessionId}
                        className={cn(
                          "rounded-xl border border-line/70 bg-surface-raised px-3 py-2.5",
                          row.isToday && "ring-1 ring-brand/40",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">
                              {row.weekday}
                              {row.isToday ? (
                                <span className="ml-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-brand">
                                  Today
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-mute">{row.dayLabel}</p>
                            <p className="mt-0.5 text-xs text-ink-soft">
                              {row.startLabel}–{row.endLabel}
                              {row.room ? ` · ${row.room}` : ""}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                              STATUS_TONE[row.status],
                            )}
                          >
                            {subjectReportStatusLabel(row.status)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-mist/60 px-2 py-2 ring-1 ring-line/50",
        className,
      )}
    >
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-mute">
        {label}
      </dt>
      <dd className="font-display mt-0.5 text-lg font-semibold tabular-nums text-ink">
        {value}
      </dd>
    </div>
  );
}
