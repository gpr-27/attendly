"use client";

import type { Subject } from "@/lib/db";
import { formatBunkInsight, type SubjectStanding } from "@/lib/attendance";
import { cn } from "@/lib/cn";

export type InsightRow = {
  subject: Subject;
  standing: SubjectStanding;
};

type RuleCardsProps = {
  rows: InsightRow[];
  /** Opens subject schedule + marks report. */
  onSelectSubject?: (row: InsightRow) => void;
};

const TONE = {
  Safe: "border-risk-safe/25 bg-risk-safe-bg text-risk-safe",
  Warning: "border-risk-watch/25 bg-risk-watch-bg text-risk-watch",
  Critical: "border-risk-danger/25 bg-risk-danger-bg text-risk-danger",
} as const;

export function RuleCards({ rows, onSelectSubject }: RuleCardsProps) {
  if (rows.length === 0) {
    return (
      <div className="rise rounded-[var(--radius)] border border-dashed border-line bg-surface-raised/60 px-4 py-10 text-center">
        <p className="font-display text-lg text-ink">No rule cards yet</p>
        <p className="mt-1 text-sm text-mute">
          Mark attendance on Today — cards are computed from your Dexie data.
        </p>
      </div>
    );
  }

  return (
    <ul className="@container rise grid grid-cols-1 gap-2.5 @md:grid-cols-2">
      {rows.map((row) => {
        const { subject, standing } = row;
        const body = formatBunkInsight(standing);
        const pct =
          standing.percentage == null
            ? "—"
            : `${standing.percentage.toFixed(1)}%`;
        const clickable = Boolean(onSelectSubject);

        const inner = (
          <>
            <div className="flex items-start justify-between gap-2">
              <p
                className="line-clamp-2 min-w-0 font-semibold leading-snug"
                title={subject.name}
              >
                {subject.name}
              </p>
              <p className="font-display shrink-0 text-xl tabular-nums">{pct}</p>
            </div>
            <p className="mt-0.5 text-xs text-mute">
              {subject.shortCode &&
              subject.shortCode.toLowerCase() !== subject.name.toLowerCase()
                ? `${subject.shortCode} · `
                : ""}
              vs {standing.effectiveTargetPct}% target
            </p>
            <p className="mt-1 text-sm leading-snug opacity-90">{body}</p>
            {clickable ? (
              <p className="mt-1.5 text-[0.65rem] font-medium opacity-80">
                Tap for schedule report →
              </p>
            ) : null}
          </>
        );

        return (
          <li key={String(subject.id)}>
            {clickable ? (
              <button
                type="button"
                onClick={() => onSelectSubject?.(row)}
                className={cn(
                  "w-full rounded-[var(--radius)] border px-4 py-3 text-left transition hover:brightness-[0.98] active:scale-[0.99]",
                  TONE[standing.risk],
                )}
                aria-label={`Open report for ${subject.name}`}
              >
                {inner}
              </button>
            ) : (
              <div
                className={cn(
                  "rounded-[var(--radius)] border px-4 py-3",
                  TONE[standing.risk],
                )}
              >
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
