"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { addMonths, format } from "date-fns";
import { AiOnboardingTip } from "@/components/ai/ai-assistant-panel";
import { OnboardingIntro } from "@/components/onboarding/onboarding-intro";
import { mondayOfWeekYmd, todayYmd } from "@/lib/dates";

const CRITERIA = [75, 80, 85] as const;

function defaultSemesterBounds() {
  const start = mondayOfWeekYmd(todayYmd());
  const end = format(
    addMonths(new Date(start + "T12:00:00"), 4),
    "yyyy-MM-dd",
  );
  return { start, end };
}

export default function OnboardingPage() {
  const router = useRouter();
  const defaults = useMemo(() => defaultSemesterBounds(), []);
  const [targetPct, setTargetPct] = useState<(typeof CRITERIA)[number]>(75);
  const [bufferPct, setBufferPct] = useState(2);
  const [semesterName, setSemesterName] = useState("");
  const [semesterStart, setSemesterStart] = useState(defaults.start);
  const [semesterEnd, setSemesterEnd] = useState(defaults.end);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const start = semesterStart.trim();
      const end = semesterEnd.trim();
      if (!start || !end) {
        throw new Error("Semester start and end dates are required.");
      }
      if (end < start) {
        throw new Error("Semester end must be on or after start.");
      }
      const { saveSettings } = await import("@/lib/db");
      await saveSettings({
        targetPct,
        bufferPct: Math.max(0, Math.min(15, bufferPct)),
        semesterName: semesterName.trim(),
        semesterStart: start,
        semesterEnd: end,
        workingDays: [1, 2, 3, 4, 5, 6],
        onboarded: true,
      });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col px-4 pb-10 pt-6">
      <OnboardingIntro />

      <AiOnboardingTip />

      <section className="rise rise-delay-1 space-y-6">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">
            College minimum
          </p>
          <div className="grid grid-cols-3 gap-2">
            {CRITERIA.map((pct) => {
              const active = targetPct === pct;
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setTargetPct(pct)}
                  className={
                    active
                      ? "rounded-2xl bg-brand px-3 py-4 text-center text-white shadow-sm"
                      : "rounded-2xl border border-line bg-surface-raised px-3 py-4 text-center text-ink"
                  }
                >
                  <span className="font-display text-2xl font-semibold tabular-nums">
                    {pct}
                  </span>
                  <span className="mt-0.5 block text-xs opacity-80">%</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink">
            Semester label
          </span>
          <input
            value={semesterName}
            onChange={(e) => setSemesterName(e.target.value)}
            placeholder="Semester name (optional)"
            className="w-full rounded-xl border border-line bg-surface-raised px-3.5 py-3 text-ink outline-none ring-brand focus:ring-2"
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">
            Semester dates
          </p>
          <p className="mb-2 text-xs text-mute">
            Your weekly timetable repeats on every working day between these
            dates. Set start to the first teaching week (not just today).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-mute">
              Start
              <input
                type="date"
                required
                value={semesterStart}
                onChange={(e) => setSemesterStart(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-surface-raised px-3 py-3 text-sm text-ink outline-none ring-brand focus:ring-2"
              />
            </label>
            <label className="block text-xs font-medium text-mute">
              End
              <input
                type="date"
                required
                value={semesterEnd}
                onChange={(e) => setSemesterEnd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-surface-raised px-3 py-3 text-sm text-ink outline-none ring-brand focus:ring-2"
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink">
            Personal buffer
          </span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={bufferPct}
              onChange={(e) => setBufferPct(Number(e.target.value))}
              className="w-full accent-[var(--brand)]"
            />
            <span className="font-display w-12 text-right text-xl font-semibold tabular-nums text-ink">
              +{bufferPct}
            </span>
          </div>
          <p className="mt-1 text-xs text-mute">
            Effective watch line: {targetPct + bufferPct}%
          </p>
        </label>
      </section>

      {error ? (
        <p className="mt-4 text-sm text-risk-danger">{error}</p>
      ) : null}

      <div className="mt-auto pt-10">
        <button
          type="button"
          disabled={saving}
          onClick={finish}
          className="w-full rounded-2xl bg-brand py-4 text-center text-base font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60"
        >
          {saving ? "Saving…" : "Start Attendly"}
        </button>
      </div>
    </main>
  );
}
