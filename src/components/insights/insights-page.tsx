"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSettings,
  listAttendance,
  listCalendarBlocks,
  listSessions,
  listSubjects,
  type AttendanceRecord,
  type ClassSession,
  type Subject,
} from "@/lib/db";
import {
  calculateSubjectStanding,
  countAttendanceFromMarks,
  countRemainingClasses,
  resolveCollegeTargetPct,
  type OdCountsAs,
} from "@/lib/attendance";
import { todayYmd } from "@/lib/dates";
import { ensureSessionsMaterialized } from "@/lib/timetable";
import { AgentFab, AgentSheet } from "@/components/ai/agent-sheet";
import {
  RuleCards,
  type InsightRow,
} from "@/components/insights/rule-cards";
import { SubjectReportSheet } from "@/components/subjects/subject-report-sheet";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyHub } from "@/components/ui/empty-hub";
import { BookOpen, CalendarDays, Camera } from "lucide-react";
import Link from "next/link";
import { useAiFocusOptional } from "@/components/ai/ai-focus-context";

export type { InsightRow };

function mapOd(settingsOd: string | undefined): OdCountsAs {
  if (settingsOd === "present" || settingsOd === "absent") return settingsOd;
  return "exclude";
}

export function InsightsPage() {
  const focusCtx = useAiFocusOptional();
  const [rows, setRows] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [reportSubjectId, setReportSubjectId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      try {
        await ensureSessionsMaterialized();
      } catch {
        /* Rem forecast best-effort */
      }

      const [subjects, sessions, marks, settings, blocks] = await Promise.all([
        listSubjects(),
        listSessions(),
        listAttendance(),
        getSettings(),
        listCalendarBlocks(),
      ]);

      const sessionById = new Map<string, ClassSession>();
      for (const s of sessions) sessionById.set(String(s.id), s);

      const countableSessions = sessions.map((s) => ({
        subjectId: String(s.subjectId),
        startsAt: s.startsAt,
        status: s.status,
        countsTowardAttendance: s.countsTowardAttendance,
        sessionType: s.sessionType,
      }));
      const asOf = todayYmd();
      const semesterEnd = settings.semesterEnd?.trim() || undefined;

      const marksBySubject = new Map<
        string,
        Array<{
          markStatus: AttendanceRecord["status"];
          sessionStatus?: string;
          countsTowardAttendance?: boolean;
        }>
      >();

      for (const mark of marks) {
        const session = sessionById.get(String(mark.sessionId));
        if (!session) continue;
        const sid = String(session.subjectId);
        const list = marksBySubject.get(sid) ?? [];
        list.push({
          markStatus: mark.status,
          sessionStatus: session.status,
          countsTowardAttendance: session.countsTowardAttendance,
        });
        marksBySubject.set(sid, list);
      }

      const od = mapOd(settings.odCountsAs as string | undefined);
      const next: InsightRow[] = [];

      for (const subject of subjects.filter((s: Subject) => !s.archived)) {
        const sid = String(subject.id);
        const { attended, total } = countAttendanceFromMarks(
          marksBySubject.get(sid) ?? [],
          od,
        );
        const remaining = countRemainingClasses({
          sessions: countableSessions,
          asOfYmd: asOf,
          semesterEnd,
          subjectId: sid,
          calendarBlocks: blocks,
        });
        const standing = calculateSubjectStanding(
          attended,
          total,
          {
            collegeTargetPct: resolveCollegeTargetPct({
              settingsTargetPct: settings.targetPct,
              subjectTargetPct: subject.targetPct,
            }),
            bufferPct: settings.bufferPct,
          },
          remaining,
        );
        next.push({ subject, standing });
      }

      next.sort((a, b) => {
        const order = { Critical: 0, Warning: 1, Safe: 2 };
        return order[a.standing.risk] - order[b.standing.risk];
      });

      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load insights");
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
    <main className="w-full max-w-4xl px-4 pb-6 pt-6 sm:px-6 md:pb-24 lg:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="Rules first"
          title="Coach"
          description="Tap a subject for its schedule + marks report. Agent opens in a full-screen popup."
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
      ) : rows.length === 0 ? (
        <EmptyHub
          eyebrow="No standing yet"
          title="Coach still works"
          description="Add a timetable and mark classes for rule cards. Eligibility is per subject (default 75%), not one overall %."
          actions={[
            {
              href: "/timetable",
              title: "Set up timetable",
              blurb: "Build your week plan.",
              icon: CalendarDays,
              primary: true,
            },
            {
              href: "/import",
              title: "Import photo",
              blurb: "Gemini parse → confirm into Dexie.",
              icon: Camera,
              primary: true,
            },
            {
              href: "/subjects",
              title: "Subject rings",
              blurb: "See % once you have marks.",
              icon: BookOpen,
            },
          ]}
          footer={
            <>
              Or jump to{" "}
              <Link
                href="/plan"
                className="font-medium text-brand hover:underline"
              >
                Plan bunks
              </Link>
              .
            </>
          }
        />
      ) : (
        <RuleCards
          rows={rows}
          onSelectSubject={(row) => setReportSubjectId(String(row.subject.id))}
        />
      )}

      <SubjectReportSheet
        subjectId={reportSubjectId}
        open={Boolean(reportSubjectId)}
        onClose={() => setReportSubjectId(null)}
      />

      <AgentFab className="hidden md:inline-flex" onClick={() => setAgentOpen(true)} />
      <AgentSheet
        open={agentOpen}
        onOpenChange={setAgentOpen}
        pageKey="insights"
        onDataChanged={() => void reload()}
      />
    </main>
  );
}
