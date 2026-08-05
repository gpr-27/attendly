import { cn } from "@/lib/utils/cn";
import type { RiskLevel } from "@/lib/today-types";

const COPY: Record<
  RiskLevel,
  { label: string; hint: string; tone: string }
> = {
  safe: {
    label: "Safe to bunk",
    hint: "You’re above target with buffer. One skip won’t hurt.",
    tone: "bg-risk-safe-bg text-risk-safe border-risk-safe/25",
  },
  watch: {
    label: "Watch closely",
    hint: "Near the line — skip only if you must, then catch up.",
    tone: "bg-risk-watch-bg text-risk-watch border-risk-watch/25",
  },
  danger: {
    label: "Attend today",
    hint: "Below target. Showing up protects your eligibility.",
    tone: "bg-risk-danger-bg text-risk-danger border-risk-danger/25",
  },
};

type RiskBannerProps = {
  /** null = no marks yet → empty decision state */
  level: RiskLevel | null;
  overallPct: number | null;
  targetPct: number;
  className?: string;
};

export function RiskBanner({
  level,
  overallPct,
  targetPct,
  className,
}: RiskBannerProps) {
  if (level === null || overallPct === null) {
    return (
      <section
        className={cn(
          "rise rounded-[var(--radius)] border border-line bg-surface-raised px-4 py-3.5",
          className,
        )}
      >
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-mute">
          Decision
        </p>
        <h2 className="font-display mt-0.5 text-xl font-semibold tracking-tight text-ink">
          No attendance yet
        </h2>
        <p className="mt-2 text-sm leading-snug text-ink-soft">
          Mark a class or import a timetable — risk shows up once you have real
          numbers. Target stays {targetPct}%.
        </p>
      </section>
    );
  }

  const copy = COPY[level];

  return (
    <section
      className={cn(
        "rise rounded-[var(--radius)] border px-4 py-3.5",
        copy.tone,
        className,
      )}
      aria-live="polite"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] opacity-80">
            Decision
          </p>
          <h2 className="font-display mt-0.5 text-xl font-semibold tracking-tight">
            {copy.label}
          </h2>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-semibold leading-none tabular-nums">
            {overallPct.toFixed(1)}
            <span className="text-lg">%</span>
          </p>
          <p className="mt-0.5 text-[0.7rem] font-medium opacity-75">
            target {targetPct}%
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm leading-snug opacity-90">{copy.hint}</p>
    </section>
  );
}
