"use client";

import type { StreakStats } from "@/lib/analytics/patterns";

type StreakCardsProps = {
  streaks: StreakStats;
};

export function StreakCards({ streaks }: StreakCardsProps) {
  if (streaks.daysWithMarks === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-surface-raised/80 px-4 py-5">
        <h2 className="font-display text-lg font-semibold text-ink">Streaks</h2>
        <p className="mt-1 text-sm text-mute">
          Mark Present/Absent on Today to start a streak. Nothing is invented
          here.
        </p>
      </section>
    );
  }

  const tiles = [
    {
      label: "Present streak",
      value: streaks.currentPresentStreak,
      hint: "Days with ≥1 present and no absents",
    },
    {
      label: "Best present",
      value: streaks.longestPresentStreak,
      hint: "Longest clean present run",
    },
    {
      label: "Marking streak",
      value: streaks.currentMarkStreak,
      hint: "Consecutive days you marked something",
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Streaks</h2>
        <p className="mt-0.5 text-sm text-mute">
          From {streaks.daysWithMarks} day
          {streaks.daysWithMarks === 1 ? "" : "s"} with marks ·{" "}
          {streaks.totalPresents} present · {streaks.totalAbsences} absent
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <li
            key={tile.label}
            className="rounded-2xl border border-line bg-surface-raised px-4 py-3"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-mute">
              {tile.label}
            </p>
            <p className="font-display mt-1 text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-mute">{tile.hint}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
