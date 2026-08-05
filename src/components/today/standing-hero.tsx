import { cn } from "@/lib/utils/cn";
import type { SubjectStandingRow } from "@/lib/attendance";

const RISK_COPY = {
  safe: {
    label: "Safe",
    ring: "var(--risk-safe)",
    wash: "bg-risk-safe-bg/70",
    badge: "bg-risk-safe-bg text-risk-safe ring-1 ring-risk-safe/35",
  },
  watch: {
    label: "Watch",
    ring: "var(--risk-watch)",
    wash: "bg-risk-watch-bg/70",
    badge: "bg-risk-watch-bg text-risk-watch ring-1 ring-risk-watch/35",
  },
  danger: {
    label: "Attend",
    ring: "var(--risk-danger)",
    wash: "bg-risk-danger-bg/70",
    badge: "bg-risk-danger-bg text-risk-danger ring-1 ring-risk-danger/35",
  },
} as const;

type StandingHeroProps = {
  subjects: SubjectStandingRow[];
  targetPct: number;
  bufferPct: number;
  className?: string;
};

/**
 * Per-subject eligibility hero — each class must hit its own target (default 75%),
 * not an overall average.
 */
export function StandingHero({
  subjects,
  targetPct,
  bufferPct,
  className,
}: StandingHeroProps) {
  const atRisk = subjects.filter((s) => s.risk !== "safe").length;
  const withMarks = subjects.filter((s) => s.standing.total > 0).length;

  return (
    <section
      className={cn(
        "@container rise rounded-2xl border border-line bg-surface-raised px-4 py-4 sm:px-5",
        className,
      )}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-mute">
          Standing · per subject
        </p>
        <p className="text-xs text-mute">
          Target {targetPct}%
          {bufferPct > 0 ? ` · buffer +${bufferPct}%` : ""}
        </p>
      </div>

      {subjects.length === 0 ? (
        <div className="mt-3">
          <h2 className="font-display text-xl font-semibold text-ink">
            No subjects yet
          </h2>
          <p className="mt-1 text-sm leading-snug text-ink-soft">
            Eligibility is judged per subject vs {targetPct}% — never as one
            overall %. Add subjects via Timetable or Import.
          </p>
        </div>
      ) : (
        <>
          <h2 className="font-display mt-2 text-lg font-semibold tracking-tight text-ink sm:text-xl">
            {withMarks === 0
              ? "Mark classes to light up risk"
              : atRisk === 0
                ? "Every subject at target"
                : atRisk === 1
                  ? "1 subject below the line"
                  : `${atRisk} subjects need attention`}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Each subject must stay ≥ its own criteria — not an overall average.
          </p>

          {/*
            Single column until the *container* is wide (~28rem). Viewport sm:grid-cols-2
            was crushing names inside Today's narrow standing rail ("Su..", "Ele..").
          */}
          <ul className="mt-3 grid grid-cols-1 gap-2 @md:grid-cols-2">
            {subjects.map((row) => {
              const tone = RISK_COPY[row.risk];
              const pct = row.standing.percentage;
              const target = row.standing.effectiveTargetPct;
              return (
                <li
                  key={row.subjectId}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border border-line px-3 py-2.5 bg-surface",
                    tone.wash,
                  )}
                >
                  <MiniRing
                    pct={pct}
                    target={target}
                    tone={tone.ring}
                    color={row.color}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="line-clamp-2 text-sm font-semibold leading-snug text-ink"
                        title={row.name}
                      >
                        {row.name}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                          tone.badge,
                        )}
                      >
                        {tone.label}
                      </span>
                    </div>
                    {row.shortCode &&
                    row.shortCode.toLowerCase() !== row.name.toLowerCase() ? (
                      <p
                        className="mt-0.5 text-xs font-medium text-ink-soft"
                        title={row.shortCode}
                      >
                        {row.shortCode}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs font-medium leading-snug text-ink-soft">
                      {row.bunkInsight}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function MiniRing({
  pct,
  target,
  tone,
  color,
}: {
  pct: number | null;
  target: number;
  tone: string;
  color: string;
}) {
  const size = 48;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fill = pct == null ? 0 : Math.min(100, Math.max(0, pct)) / 100;
  const offset = c * (1 - fill);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ring-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pct == null ? "var(--mute)" : tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-display text-sm font-semibold leading-none tabular-nums",
            pct == null && "text-ink-soft",
          )}
          style={{ color: pct == null ? undefined : color }}
        >
          {pct === null ? "—" : Math.round(pct)}
          {pct !== null ? (
            <span className="text-[0.55rem]">%</span>
          ) : null}
        </span>
        <span className="text-[0.5rem] font-medium text-ink-soft">
          /{target}%
        </span>
      </div>
    </div>
  );
}
