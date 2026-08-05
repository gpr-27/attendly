"use client";

import Link from "next/link";
import { BunkSimulator } from "@/components/plan/bunk-simulator";
import { SafeWeekPlanner } from "@/components/plan/safe-week-planner";
import { SemesterProjectionPanel } from "@/components/plan/semester-projection";
import { CalendarBlocksEditor } from "@/components/settings/calendar-blocks-editor";

export function PlanPage() {
  return (
    <main className="w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="rise mb-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
          Scenario
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Plan attendance
        </h1>
        <p className="mt-1.5 text-sm text-mute">
          Bunk simulator, safe-week impact, and semester-end projection from
          your real marks — rules own the math.
        </p>
        <p className="mt-2 text-sm">
          <Link
            href="/plan/safe-week"
            className="font-medium text-brand hover:underline"
          >
            Open safe-week planner →
          </Link>
        </p>
      </header>

      <section className="rise rise-delay-1 mb-10">
        <h2 className="font-display mb-3 text-xl font-semibold text-ink">
          Bunk simulator
        </h2>
        <BunkSimulator />
      </section>

      <section className="rise rise-delay-2 mb-10">
        <h2 className="font-display mb-1 text-xl font-semibold text-ink">
          Safe week
        </h2>
        <p className="mb-3 text-sm text-mute">
          Festival, travel, or placement window — see what each subject loses if
          you miss those days.
        </p>
        <SafeWeekPlanner />
      </section>

      <section className="rise rise-delay-3 mb-10">
        <h2 className="font-display mb-1 text-xl font-semibold text-ink">
          Semester-end projection
        </h2>
        <p className="mb-3 text-sm text-mute">
          Remaining classes exclude exam weeks and holidays you mark below.
        </p>
        <SemesterProjectionPanel />
      </section>

      <section className="rise rise-delay-3 mb-6">
        <CalendarBlocksEditor />
      </section>
    </main>
  );
}
