"use client";

import type { InsightCard } from "@/lib/ai/ai-focus";
import { cn } from "@/lib/utils/cn";

const TONE: Record<InsightCard["tone"], string> = {
  safe: "border-risk-safe/25 bg-risk-safe-bg text-risk-safe",
  watch: "border-risk-watch/25 bg-risk-watch-bg text-risk-watch",
  danger: "border-risk-danger/25 bg-risk-danger-bg text-risk-danger",
  neutral: "border-line/70 bg-mist/60 text-ink-soft",
};

type SubjectInsightCardsProps = {
  cards: InsightCard[];
  title?: string;
  className?: string;
};

/**
 * Instant local insight strip — bunks / risk / skip / pattern.
 * Shown before (and while) the coach reply loads.
 */
export function SubjectInsightCards({
  cards,
  title,
  className,
}: SubjectInsightCardsProps) {
  if (cards.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {title ? (
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-mute">
          {title}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {cards.map((card) => (
          <li
            key={card.id}
            className={cn(
              "rounded-xl border px-2.5 py-2",
              TONE[card.tone],
            )}
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide opacity-80">
              {card.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-ink">
              {card.value}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
