"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listAttendance, listSessions } from "@/lib/db";
import { computeStreaks } from "@/lib/analytics/patterns";
import {
  buildAnalyticsKeyPoints,
  loadSubjectStandings,
  type SubjectStandingRow,
} from "@/lib/attendance";
import { PageHeader } from "@/components/ui/page-header";
import { AttendanceReportButton } from "@/components/analytics/print-report";
import { AgentFab, AgentSheet } from "@/components/ai/agent-sheet";
import { EmptyHub } from "@/components/ui/empty-hub";
import { StandingHero } from "@/components/today/standing-hero";
import { CalendarDays, Camera, Home } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAiFocusOptional } from "@/components/ai/ai-focus-context";

const KEY_TONE = {
  safe: "border-risk-safe/25 bg-risk-safe-bg text-risk-safe",
  watch: "border-risk-watch/25 bg-risk-watch-bg text-risk-watch",
  danger: "border-risk-danger/25 bg-risk-danger-bg text-risk-danger",
  neutral: "border-line bg-surface-raised text-ink-soft",
} as const;

export function AnalyticsPage() {
  const focusCtx = useAiFocusOptional();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMarks, setHasMarks] = useState(false);
  const [subjects, setSubjects] = useState<SubjectStandingRow[]>([]);
  const [targetPct, setTargetPct] = useState(75);
  const [bufferPct, setBufferPct] = useState(0);
  const [keyPoints, setKeyPoints] = useState<
    ReturnType<typeof buildAnalyticsKeyPoints>
  >([]);
  const [agentOpen, setAgentOpen] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [sessions, marks, standing] = await Promise.all([
        listSessions(),
        listAttendance(),
        loadSubjectStandings(),
      ]);

      setHasMarks(marks.length > 0);
      setSubjects(standing.rows);
      setTargetPct(standing.targetPct);
      setBufferPct(standing.bufferPct);

      const streaks = computeStreaks(sessions, marks);
      setKeyPoints(
        buildAnalyticsKeyPoints(standing.rows, {
          presentStreak: streaks.currentPresentStreak,
          totalAbsences: streaks.totalAbsences,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (focusCtx?.sheetOpen) setAgentOpen(true);
  }, [focusCtx?.sheetOpen, focusCtx?.focusNonce]);

  return (
    <main className="w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="History"
          title="Analytics"
          description="2–3 things that matter — each subject vs its own eligibility line (default 75%)."
        />
        <AgentFab variant="pill" onClick={() => setAgentOpen(true)} />
      </div>

      {error ? (
        <p className="mb-3 rounded-2xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-mute">Loading…</p>
      ) : !hasMarks && subjects.length === 0 ? (
        <EmptyHub
          eyebrow="No marks yet"
          title="Analytics needs real attendance"
          description="Mark classes on Today. Eligibility is per subject — never one overall %."
          actions={[
            {
              href: "/",
              title: "Mark Today",
              blurb: "Present / Absent on your agenda.",
              icon: Home,
              primary: true,
            },
            {
              href: "/calendar",
              title: "Month calendar",
              blurb: "Status dots once you have marks.",
              icon: CalendarDays,
            },
            {
              href: "/import",
              title: "Import timetable",
              blurb: "Photo or Timetable first.",
              icon: Camera,
            },
          ]}
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-2.5">
            <h2 className="font-display text-lg font-semibold text-ink">
              Key points
            </h2>
            <ul className="space-y-2">
              {keyPoints.map((point) => (
                <li
                  key={point.id}
                  className={cn(
                    "rounded-2xl border px-4 py-3",
                    KEY_TONE[point.tone],
                  )}
                >
                  <p className="text-sm font-semibold text-ink">{point.title}</p>
                  <p className="mt-0.5 text-sm opacity-90">{point.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <StandingHero
            subjects={subjects}
            targetPct={targetPct}
            bufferPct={bufferPct}
          />

          <div className="flex flex-wrap items-center gap-3">
            <AttendanceReportButton
              label="Download attendance PDF"
              variant="primary"
            />
            <Link
              href="/calendar"
              className="text-sm font-medium text-brand hover:underline"
            >
              Month heatmap →
            </Link>
            <Link
              href="/insights"
              className="text-sm font-medium text-brand hover:underline"
            >
              Coach →
            </Link>
          </div>
        </div>
      )}

      <AgentFab onClick={() => setAgentOpen(true)} />
      <AgentSheet
        open={agentOpen}
        onOpenChange={setAgentOpen}
        pageKey="analytics"
        onDataChanged={() => void reload()}
      />
    </main>
  );
}
