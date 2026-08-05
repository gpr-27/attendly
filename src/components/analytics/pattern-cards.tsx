"use client";

import type { PatternCard } from "@/lib/analytics/patterns";
import { cn } from "@/lib/utils/cn";

const TONE: Record<PatternCard["tone"], string> = {
  watch: "border-risk-watch/40 bg-risk-watch-bg",
  safe: "border-risk-safe/40 bg-risk-safe-bg",
  neutral: "border-line bg-surface-raised",
};

type PatternCardsProps = {
  cards: PatternCard[];
};

export function PatternCards({ cards }: PatternCardsProps) {
  if (cards.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-surface-raised/80 px-4 py-5">
        <h2 className="font-display text-lg font-semibold text-ink">
          Patterns
        </h2>
        <p className="mt-1 text-sm text-mute">
          Weekday habits show up once you have enough real absences and
          presents.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-ink">Patterns</h2>
      <ul className="space-y-2">
        {cards.map((card) => (
          <li
            key={card.id}
            className={cn(
              "rounded-2xl border px-4 py-3",
              TONE[card.tone],
            )}
          >
            <p className="font-semibold text-ink">{card.title}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{card.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
