"use client";

import { PctRing } from "@/components/subjects/pct-ring";
import { ComponentTargetsForm } from "@/components/subjects/component-targets-form";
import type { Subject } from "@/lib/db";
import { formatBunkInsight, type SubjectStanding } from "@/lib/attendance";
import { cn } from "@/lib/cn";

type SubjectCardProps = {
  subject: Subject;
  standing: SubjectStanding;
  settingsTargetPct: number;
  onTargetsSaved?: () => void;
  /** Opens subject schedule + marks report. */
  onSelectForAi?: () => void;
  selected?: boolean;
  /** Permanent cascade delete. */
  onRemove?: () => void;
  removeBusy?: boolean;
};

const RISK_TONE = {
  Safe: "bg-risk-safe-bg text-risk-safe",
  Warning: "bg-risk-watch-bg text-risk-watch",
  Critical: "bg-risk-danger-bg text-risk-danger",
} as const;

export function SubjectCard({
  subject,
  standing,
  settingsTargetPct,
  onTargetsSaved,
  onSelectForAi,
  selected,
  onRemove,
  removeBusy,
}: SubjectCardProps) {
  const pct = standing.percentage;
  const tone = RISK_TONE[standing.risk];
  const detail = formatBunkInsight(standing);

  const componentBits = subject.componentTargets
    ? (
        ["theory", "lab", "tutorial"] as const
      )
        .filter((k) => subject.componentTargets?.[k] != null)
        .map((k) => `${k[0]!.toUpperCase()}${subject.componentTargets![k]}`)
        .join(" · ")
    : "";

  return (
    <article
      className={cn(
        "rounded-[var(--radius)] bg-surface-raised p-3.5 ring-1 ring-line transition",
        selected && "ring-2 ring-brand/50",
      )}
    >
      <button
        type="button"
        onClick={onSelectForAi}
        disabled={!onSelectForAi}
        className={cn(
          "flex w-full items-center gap-3 text-left",
          onSelectForAi && "cursor-pointer",
          !onSelectForAi && "cursor-default",
        )}
        aria-label={
          onSelectForAi ? `Report for ${subject.name}` : subject.name
        }
      >
        <span
          className="h-10 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: subject.color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h2
              className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug text-ink"
              title={subject.name}
            >
              {subject.name}
            </h2>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                tone,
              )}
            >
              {standing.risk}
            </span>
          </div>
          {subject.shortCode &&
          subject.shortCode.toLowerCase() !== subject.name.toLowerCase() ? (
            <p className="text-xs text-mute" title={subject.shortCode}>
              {subject.shortCode}
            </p>
          ) : null}
          <p className="mt-1 text-xs font-medium text-ink-soft">{detail}</p>
          {componentBits ? (
            <p className="mt-0.5 text-[0.65rem] text-mute">
              Components {componentBits}
            </p>
          ) : null}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist">
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${Math.min(100, pct ?? 0)}%`,
                backgroundColor: subject.color,
              }}
            />
          </div>
          {onSelectForAi ? (
            <p className="mt-1.5 text-[0.65rem] font-medium text-brand">
              Tap for schedule report →
            </p>
          ) : null}
        </div>
        <PctRing
          pct={pct}
          color={subject.color}
          label={pct == null ? "—" : `${pct.toFixed(0)}%`}
        />
      </button>
      {onTargetsSaved ? (
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <ComponentTargetsForm
            subject={subject}
            settingsTargetPct={settingsTargetPct}
            onSaved={onTargetsSaved}
          />
        </div>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          disabled={removeBusy}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="mt-3 w-full rounded-full px-3 py-2 text-xs font-semibold text-risk-danger ring-1 ring-risk-danger/30 transition hover:bg-risk-danger-bg disabled:opacity-50"
        >
          Remove subject
        </button>
      ) : null}
    </article>
  );
}
