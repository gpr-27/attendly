"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Camera } from "lucide-react";
import {
  addSubject,
  colorForIndex,
  deleteSubject,
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
  type SubjectStanding,
} from "@/lib/attendance";
import { todayYmd } from "@/lib/dates";
import { SubjectCard } from "@/components/subjects/subject-card";
import { SubjectReportSheet } from "@/components/subjects/subject-report-sheet";
import { ConfirmDialog } from "@/components/timetable/confirm-dialog";
import { EmptyHub } from "@/components/ui/empty-hub";
import { AddSubjectForm } from "@/components/timetable/add-subject-form";
import { ensureSessionsMaterialized } from "@/lib/timetable";

type Row = {
  subject: Subject;
  standing: SubjectStanding;
};

function mapOd(settingsOd: string | undefined): OdCountsAs {
  if (settingsOd === "present" || settingsOd === "absent") return settingsOd;
  return "exclude";
}

export function SubjectsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportSubjectId, setReportSubjectId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [targetPct, setTargetPct] = useState(75);
  const [pendingRemove, setPendingRemove] = useState<Row | null>(null);
  const [removing, setRemoving] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      try {
        await ensureSessionsMaterialized();
      } catch {
        /* Rem best-effort */
      }
      const [subjects, sessions, marks, settings, blocks] = await Promise.all([
        listSubjects(),
        listSessions(),
        listAttendance(),
        getSettings(),
        listCalendarBlocks(),
      ]);
      setTargetPct(settings.targetPct);

      const sessionById = new Map<string, ClassSession>();
      for (const s of sessions) sessionById.set(String(s.id), s);

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
      const asOf = todayYmd();
      const semesterEnd = settings.semesterEnd?.trim() || undefined;
      const countableSessions = sessions.map((s) => ({
        subjectId: String(s.subjectId),
        startsAt: s.startsAt,
        status: s.status,
        countsTowardAttendance: s.countsTowardAttendance,
        sessionType: s.sessionType,
      }));

      const next: Row[] = subjects
        .filter((s) => !s.archived)
        .map((subject) => {
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
          return { subject, standing };
        })
        .sort((a, b) => {
          const ap = a.standing.percentage ?? 999;
          const bp = b.standing.percentage ?? 999;
          return ap - bp;
        });

      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load subjects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleAddSubject(input: {
    name: string;
    shortCode: string;
    color: string;
  }) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await addSubject({
        name: input.name,
        shortCode: input.shortCode,
        color: input.color,
      });
      setShowAdd(false);
      setSuccess(`Added ${created.shortCode}.`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add subject");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setRemoving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteSubject(String(pendingRemove.subject.id));
      try {
        await ensureSessionsMaterialized();
      } catch {
        /* rematerialize best-effort */
      }
      setSuccess(`Removed ${pendingRemove.subject.name}.`);
      setPendingRemove(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove subject");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <main className="w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="rise mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
            Standing · target {targetPct}%
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Subjects
          </h1>
          <p className="mt-1.5 text-sm text-mute">
            Tap a subject for its schedule + marks report (which day, which class).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAdd((v) => !v);
            setError(null);
            setSuccess(null);
          }}
          className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white"
        >
          Add subject
        </button>
      </header>

      {error ? (
        <p className="mb-3 rounded-2xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mb-3 rounded-2xl bg-risk-safe-bg px-3 py-2 text-sm text-risk-safe">
          {success}
        </p>
      ) : null}

      {showAdd ? (
        <div className="mb-4">
          <AddSubjectForm
            busy={busy}
            defaultColor={colorForIndex(rows.length)}
            onCancel={() => setShowAdd(false)}
            onSubmit={handleAddSubject}
          />
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-mute">Loading…</p>
      ) : rows.length === 0 ? (
        <SubjectsEmptyHub onAdd={() => setShowAdd(true)} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ subject, standing }, i) => (
            <li
              key={String(subject.id)}
              className={`rise rise-delay-${Math.min(i + 1, 3)}`}
            >
              <SubjectCard
                subject={subject}
                standing={standing}
                settingsTargetPct={targetPct}
                onTargetsSaved={() => void reload()}
                onSelectForAi={() => setReportSubjectId(String(subject.id))}
                selected={reportSubjectId === String(subject.id)}
                onRemove={() => setPendingRemove({ subject, standing })}
                removeBusy={removing}
              />
            </li>
          ))}
        </ul>
      )}

      <SubjectReportSheet
        subjectId={reportSubjectId}
        open={Boolean(reportSubjectId)}
        onClose={() => setReportSubjectId(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title={`Remove ${pendingRemove?.subject.name ?? "subject"}?`}
        message="This permanently deletes the subject, its weekly timetable slots, all past and future classes for it, and their attendance marks. This cannot be undone."
        confirmLabel="Remove subject"
        busy={removing}
        onConfirm={() => void confirmRemove()}
        onCancel={() => {
          if (!removing) setPendingRemove(null);
        }}
      />
    </main>
  );
}

function SubjectsEmptyHub({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="space-y-4">
      <EmptyHub
        eyebrow="No subjects yet"
        title="Add your courses"
        description="Create a subject here, quick-add on Timetable, or import photo/CSV/Excel."
        actions={[
          {
            href: "/timetable",
            title: "Set up timetable",
            blurb: "Add subject + weekly slots together.",
            icon: CalendarDays,
            primary: true,
          },
          {
            href: "/import",
            title: "Import photo / file",
            blurb: "Gemini, CSV, Excel, or PDF → confirm.",
            icon: Camera,
            primary: true,
          },
        ]}
      />
      <button
        type="button"
        onClick={onAdd}
        className="min-h-12 w-full rounded-full bg-brand text-sm font-semibold text-white"
      >
        Add subject manually
      </button>
    </div>
  );
}
