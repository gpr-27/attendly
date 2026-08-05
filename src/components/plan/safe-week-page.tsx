"use client";

import Link from "next/link";
import { SafeWeekPlanner } from "@/components/plan/safe-week-planner";

export function SafeWeekPage() {
  return (
    <main className="w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="rise mb-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
          Safe week
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Plan a time away
        </h1>
        <p className="mt-1.5 text-sm text-mute">
          Pick festival, travel, or placement dates. Per-subject impact assumes
          every class in that range is missed.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/plan" className="font-medium text-brand hover:underline">
            ← Back to plan
          </Link>
        </p>
      </header>
      <SafeWeekPlanner />
    </main>
  );
}
