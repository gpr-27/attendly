"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addSeries,
  addSubject,
  colorForIndex,
  getSettings,
  listSeries,
  listSessionsInRange,
  listSubjects,
  type ClassSession,
  type Subject,
  type TimetableSeries,
  type WeekParity,
} from "@/lib/db";
import {
  addExtraSession,
  applySeriesCancel,
  applySeriesEdit,
  buildSessionsIcs,
  deleteCancelledOccurrence,
  removeExtraSession,
  downloadIcsFile,
  ensureSemesterRange,
  ensureSessionsMaterialized,
  moveSessionOccurrence,
  timesFromSlotIndex,
  type CancelSeriesScope,
  type EditSeriesScope,
  type MoveSessionScope,
} from "@/lib/timetable";
import {
  addDaysYmd,
  dayBoundsIso,
  dayOfWeekFromYmd,
  sessionLocalYmd,
  todayYmd,
} from "@/lib/dates";
import { DayTimetable } from "@/components/timetable/day-timetable";
import { QuickAddSheet } from "@/components/timetable/quick-add-sheet";
import { EmptyGuide } from "@/components/timetable/empty-guide";
import { AddSubjectForm } from "@/components/timetable/add-subject-form";
import {
  MakeupPrompt,
  type MakeupCandidate,
} from "@/components/timetable/makeup-prompt";
import { EditSlotDialog } from "@/components/timetable/edit-slot-dialog";
import { CancelScopeDialog } from "@/components/timetable/cancel-scope-dialog";
import { ConfirmDialog } from "@/components/timetable/confirm-dialog";
import { MoveClassDialog } from "@/components/timetable/move-class-dialog";
import { useAiFocus } from "@/components/ai/ai-focus-context";
import { loadSessionFocus } from "@/lib/ai/load-subject-focus";

export function TimetablePage() {
  const { requestFocus } = useAiFocus();
  const [selectedYmd, setSelectedYmd] = useState(() => todayYmd());
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [series, setSeries] = useState<TimetableSeries[]>([]);
  const [daySessions, setDaySessions] = useState<ClassSession[]>([]);
  const [semesterStart, setSemesterStart] = useState<string | undefined>();
  const [semesterEnd, setSemesterEnd] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showSubjectOnly, setShowSubjectOnly] = useState(false);
  const [makeupCandidates, setMakeupCandidates] = useState<MakeupCandidate[]>(
    [],
  );
  const [editSlot, setEditSlot] = useState<TimetableSeries | null>(null);
  const [editMode, setEditMode] = useState<"master" | "occurrence">("occurrence");
  const [editDate, setEditDate] = useState(todayYmd);
  const [cancelTarget, setCancelTarget] = useState<{
    slot: TimetableSeries;
    date: string;
  } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{
    session: ClassSession;
    date: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassSession | null>(null);
  const [removeExtraTarget, setRemoveExtraTarget] =
    useState<ClassSession | null>(null);

  const selectedDow = dayOfWeekFromYmd(selectedYmd);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const from = addDaysYmd(selectedYmd, -1);
      const to = addDaysYmd(selectedYmd, 1);
      try {
        await ensureSessionsMaterialized({ from, to });
      } catch {
        /* semester may still be filling */
      }
      const bounds = dayBoundsIso(selectedYmd);
      const [subs, slots, settings, sessions] = await Promise.all([
        listSubjects(),
        listSeries(),
        getSettings(),
        listSessionsInRange(bounds.fromIso, bounds.toIso),
      ]);
      setSubjects(subs.filter((s) => !s.archived));
      setSeries(slots);
      setSemesterStart(settings.semesterStart?.trim() || undefined);
      setSemesterEnd(settings.semesterEnd?.trim() || undefined);
      setDaySessions(
        sessions
          .filter((s) => sessionLocalYmd(s) === selectedYmd)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load timetable");
    } finally {
      setLoading(false);
    }
  }, [selectedYmd]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const daySlots = useMemo(
    () =>
      series
        .filter((s) => s.dayOfWeek === selectedDow)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [series, selectedDow],
  );

  const subjectById = useMemo(() => {
    const map = new Map<string, Subject>();
    for (const s of subjects) map.set(String(s.id), s);
    return map;
  }, [subjects]);

  const seriesById = useMemo(() => {
    const map = new Map<string, TimetableSeries>();
    for (const s of series) map.set(String(s.id), s);
    return map;
  }, [series]);

  const nextColor = colorForIndex(subjects.length);

  async function handleCreateSubject(input: {
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
      await reload();
      setSuccess(`Subject ${created.name} saved.`);
      setShowSubjectOnly(false);
      return created;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not add subject";
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSlot(input: {
    subjectId: string;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    location?: string;
    weekParity: WeekParity;
    slotIndex: number;
    scope: "this_date" | "entire_pattern";
    date?: string;
  }) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const settings = await getSettings();
      const resolved = timesFromSlotIndex(settings, input.slotIndex);
      if (!resolved) {
        throw new Error(
          `Unknown period slotIndex ${input.slotIndex}. Check Settings → Daily periods.`,
        );
      }
      const startTime = resolved.startTime;
      const endTime = resolved.endTime;

      if (input.scope === "this_date") {
        const date = input.date || selectedYmd;
        const { findDaySlotOverlaps } = await import(
          "@/lib/timetable/slot-overlap"
        );
        const overlap = await findDaySlotOverlaps({
          date,
          startTime,
          endTime,
        });
        if (!overlap.ok) throw new Error(overlap.message);
        await addExtraSession({
          subjectId: input.subjectId,
          date,
          startTime,
          endTime,
          location: input.location,
          sessionType: "lecture",
        });
        // Rematerialize that day (extras are preserved) then reload list.
        await ensureSessionsMaterialized({ from: date, to: date });
        setSheetOpen(false);
        await reload();
        setSuccess(`Extra class added for ${date} only.`);
        return;
      }

      const range = await ensureSemesterRange();
      const days = input.daysOfWeek.filter((d) => d >= 0 && d <= 6);
      if (days.length === 0) {
        throw new Error("Pick at least one day.");
      }
      const { addDaysYmd, dayOfWeekFromYmd, todayYmd: today } = await import(
        "@/lib/dates",
      );
      const { findDaySlotOverlaps } = await import(
        "@/lib/timetable/slot-overlap",
      );
      let probe = settings.semesterStart?.trim() || today();
      if (probe < today()) probe = today();
      for (const dayOfWeek of days) {
        let checked = false;
        for (let i = 0; i < 14; i += 1) {
          const ymd = addDaysYmd(probe, i);
          if (dayOfWeekFromYmd(ymd) !== dayOfWeek) continue;
          const overlap = await findDaySlotOverlaps({
            date: ymd,
            startTime,
            endTime,
          });
          if (!overlap.ok) throw new Error(overlap.message);
          checked = true;
          break;
        }
        if (!checked) {
          throw new Error("Could not verify slot availability for a selected day.");
        }
      }
      for (const dayOfWeek of days) {
        await addSeries({
          subjectId: input.subjectId,
          dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          startTime,
          endTime,
          location: input.location,
          sessionType: "lecture",
          weekParity: input.weekParity,
          effectiveFrom: range.from,
          effectiveTo: null,
          countsTowardAttendance: true,
        });
      }
      await ensureSessionsMaterialized({ from: range.from, to: range.to });
      setSheetOpen(false);
      await reload();
      setSuccess(
        days.length > 1
          ? `Class added every week on ${days.length} days.`
          : "Class added to original permanent timetable (every week).",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save slot");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyDay(targetDays: number[]) {
    if (daySlots.length === 0 || targetDays.length === 0) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const range = await ensureSemesterRange();
      for (const target of targetDays) {
        for (const slot of daySlots) {
          await addSeries({
            subjectId: slot.subjectId,
            dayOfWeek: target as 0 | 1 | 2 | 3 | 4 | 5 | 6,
            startTime: slot.startTime,
            endTime: slot.endTime,
            location: slot.location,
            sessionType: slot.sessionType ?? "lecture",
            weekParity: slot.weekParity ?? "all",
            targetPct: slot.targetPct,
            effectiveFrom: slot.effectiveFrom || range.from,
            effectiveTo: slot.effectiveTo ?? null,
            countsTowardAttendance: slot.countsTowardAttendance ?? true,
          });
        }
      }
      await ensureSessionsMaterialized({ from: range.from, to: range.to });
      await reload();
      setSuccess(
        `Copied ${daySlots.length} slot(s) to ${targetDays.length} day(s).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not copy day");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelConfirm(scope: CancelSeriesScope) {
    if (!cancelTarget) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await applySeriesCancel({
        series: cancelTarget.slot,
        scope,
        date: cancelTarget.date,
        reason: "Cancelled for this date only",
      });
      const date = cancelTarget.date;
      setCancelTarget(null);
      if (scope === "this_date") {
        const { fromIso, toIso } = dayBoundsIso(date);
        const sessions = await listSessionsInRange(fromIso, toIso);
        const cancelled = sessions.filter((s) => s.status === "cancelled");
        setMakeupCandidates(
          cancelled.map((session) => ({
            session,
            subject: subjectById.get(String(session.subjectId)),
          })),
        );
        setSuccess("Cancelled for this date — original timetable unchanged.");
      } else {
        setSuccess("Removed from original permanent timetable.");
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveConfirm(input: {
    newDate: string;
    startTime: string;
    endTime: string;
    location?: string;
    scope: MoveSessionScope;
  }) {
    if (!moveTarget) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await moveSessionOccurrence({
        sessionId: String(moveTarget.session.id),
        ...input,
      });
      setMoveTarget(null);
      await reload();
      setSuccess(
        result.mode === "entire_pattern"
          ? "Permanent weekly slot updated."
          : `Moved to ${result.toDate} ${input.startTime}–${input.endTime}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not move class");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCancelledConfirm() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteCancelledOccurrence(String(deleteTarget.id));
      setDeleteTarget(null);
      await reload();
      setSuccess("Cancelled class removed from day view.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveExtraConfirm() {
    if (!removeExtraTarget) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await removeExtraSession(String(removeExtraTarget.id));
      setRemoveExtraTarget(null);
      await reload();
      setSuccess("Extra / makeup removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove Extra");
    } finally {
      setBusy(false);
    }
  }

  async function handleMakeup(input: {
    replacesSessionId: string;
    subjectId: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
  }) {
    setBusy(true);
    setError(null);
    try {
      await addExtraSession({
        subjectId: input.subjectId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location,
        replacesSessionId: input.replacesSessionId,
        relevance: "makeup",
        note: "Makeup for cancelled class",
      });
      await ensureSessionsMaterialized({ from: input.date, to: input.date });
      setMakeupCandidates([]);
      await reload();
      setSuccess("Makeup class added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add makeup");
    } finally {
      setBusy(false);
    }
  }

  async function handleEditSlot(
    slot: TimetableSeries,
    patch: { startTime: string; endTime: string; location?: string },
    scope: EditSeriesScope = "entire_pattern",
    date = selectedYmd,
  ) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await applySeriesEdit({ series: slot, patch, scope, date });
      await ensureSessionsMaterialized();
      await reload();
      setEditSlot(null);
      setSuccess(
        scope === "entire_pattern"
          ? "Permanent timetable updated for every week."
          : scope === "this_date"
            ? "This date updated — original timetable unchanged."
            : "This and following weeks updated.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update slot");
    } finally {
      setBusy(false);
    }
  }

  async function handleExportIcs() {
    setBusy(true);
    setError(null);
    try {
      const range = await ensureSemesterRange();
      await ensureSessionsMaterialized({ from: range.from, to: range.to });
      const settings = await getSettings();
      const fromIso = new Date(range.from + "T00:00:00").toISOString();
      const toIso = new Date(range.to + "T23:59:59").toISOString();
      const sessions: ClassSession[] = await listSessionsInRange(
        fromIso,
        toIso,
      );
      const ics = buildSessionsIcs({
        sessions,
        subjects,
        calendarName: settings.semesterName || "Attendly",
      });
      downloadIcsFile(ics, "attendly-timetable.ics");
      setSuccess("Calendar file downloaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export calendar");
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = !loading && subjects.length === 0 && series.length === 0;

  return (
    <main className="w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="rise mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
            Schedule
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Timetable
          </h1>
          <p className="mt-1.5 text-sm text-mute">
            One place for any date — change this day only, or every week on the
            permanent pattern.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setShowSubjectOnly(true);
              setSheetOpen(false);
              setSuccess(null);
              setError(null);
            }}
            className="min-h-12 rounded-full px-5 text-sm font-semibold text-ink ring-1 ring-line sm:min-h-11"
          >
            Add subject
          </button>
          <button
            type="button"
            onClick={() => {
              setSheetOpen(true);
              setShowSubjectOnly(false);
              setSuccess(null);
              setError(null);
            }}
            className="min-h-12 rounded-full bg-brand px-5 text-sm font-semibold text-white sm:min-h-11"
          >
            Add class
          </button>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-[var(--radius)] bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="mb-3 rounded-[var(--radius)] bg-risk-safe-bg px-3 py-2 text-sm text-risk-safe"
        >
          {success}
        </p>
      ) : null}

      {showSubjectOnly ? (
        <div className="mb-4">
          <AddSubjectForm
            busy={busy}
            defaultColor={nextColor}
            onCancel={() => setShowSubjectOnly(false)}
            onSubmit={async (input) => {
              await handleCreateSubject(input);
            }}
          />
        </div>
      ) : null}

      {makeupCandidates.length > 0 ? (
        <MakeupPrompt
          candidates={makeupCandidates}
          busy={busy}
          onSkip={() => setMakeupCandidates([])}
          onAddMakeup={handleMakeup}
        />
      ) : null}

      {isEmpty ? (
        <EmptyGuide
          onAddSubject={() => {
            setShowSubjectOnly(true);
            setSheetOpen(false);
          }}
          onAddClass={() => setSheetOpen(true)}
        />
      ) : (
        <>
          <DayTimetable
            selectedYmd={selectedYmd}
            onSelectedYmdChange={(ymd) => {
              setLoading(true);
              setSelectedYmd(ymd);
            }}
            sessions={daySessions}
            subjectById={subjectById}
            seriesById={seriesById}
            busy={busy}
            loading={loading}
            hasWeeklyPattern={series.length > 0}
            semesterStart={semesterStart}
            semesterEnd={semesterEnd}
            patternSlotCount={daySlots.length}
            onAddClass={() => setSheetOpen(true)}
            onCopyDay={handleCopyDay}
            onExportIcs={handleExportIcs}
            onEditOccurrence={(slot, date) => {
              setEditMode("occurrence");
              setEditDate(date);
              setEditSlot(slot);
            }}
            onCancelOccurrence={(slot, date) => {
              setCancelTarget({ slot, date });
            }}
            onMoveOccurrence={(session, date) => {
              setMoveTarget({ session, date });
            }}
            onDeleteCancelled={(session) => {
              setDeleteTarget(session);
            }}
            onRemoveExtra={(session) => {
              setRemoveExtraTarget(session);
            }}
            onInsight={(session, date) => {
              void (async () => {
                const subject = subjectById.get(String(session.subjectId));
                const start = new Date(session.startsAt);
                const end = new Date(session.endsAt);
                const startLabel = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
                const endLabel = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
                const focus = await loadSessionFocus({
                  sessionId: String(session.id),
                  subjectId: String(session.subjectId),
                  shortCode: subject?.shortCode ?? "—",
                  name: subject?.name ?? "Class",
                  startLabel,
                  endLabel,
                  ymd: date,
                });
                requestFocus(focus, { ui: "insight" });
              })();
            }}
          />

          {subjects.length > 0 ? (
            <p className="mt-6 text-xs text-mute">
              {subjects.length} subject{subjects.length === 1 ? "" : "s"} ·{" "}
              {series.length} weekly slot{series.length === 1 ? "" : "s"} ·{" "}
              <Link href="/import" className="text-brand hover:underline">
                Import photo
              </Link>
              {" · "}
              <Link href="/plan" className="text-brand hover:underline">
                Holidays / exam weeks
              </Link>
              {" · "}
              <Link href="/settings" className="text-brand hover:underline">
                Semester range
              </Link>
            </p>
          ) : null}
        </>
      )}

      <QuickAddSheet
        open={sheetOpen}
        subjects={subjects}
        busy={busy}
        defaultDay={selectedDow}
        defaultDate={selectedYmd}
        nextColor={nextColor}
        onClose={() => {
          setSheetOpen(false);
        }}
        onCreateSubject={handleCreateSubject}
        onSaveSlot={handleSaveSlot}
      />

      <EditSlotDialog
        open={Boolean(editSlot)}
        slot={editSlot}
        subject={
          editSlot
            ? subjectById.get(String(editSlot.subjectId))
            : undefined
        }
        mode={editMode}
        date={editDate}
        busy={busy}
        onClose={() => setEditSlot(null)}
        onSave={async ({ patch, scope, date }) => {
          if (!editSlot) return;
          await handleEditSlot(editSlot, patch, scope, date);
        }}
      />

      <CancelScopeDialog
        open={Boolean(cancelTarget)}
        slot={cancelTarget?.slot ?? null}
        subject={
          cancelTarget
            ? subjectById.get(String(cancelTarget.slot.subjectId))
            : undefined
        }
        date={cancelTarget?.date ?? selectedYmd}
        busy={busy}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
      />

      <MoveClassDialog
        open={Boolean(moveTarget)}
        sessionId={moveTarget ? String(moveTarget.session.id) : undefined}
        subjectLabel={
          moveTarget
            ? (subjectById.get(String(moveTarget.session.subjectId))?.name ??
              "Class")
            : ""
        }
        initialDate={moveTarget?.date ?? selectedYmd}
        initialStart={
          moveTarget
            ? (() => {
                const d = new Date(moveTarget.session.startsAt);
                return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
              })()
            : "09:00"
        }
        initialEnd={
          moveTarget
            ? (() => {
                const d = new Date(moveTarget.session.endsAt);
                return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
              })()
            : "10:00"
        }
        initialLocation={moveTarget?.session.location}
        allowPermanent={Boolean(moveTarget?.session.seriesId)}
        busy={busy}
        onClose={() => setMoveTarget(null)}
        onConfirm={handleMoveConfirm}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete cancelled class?"
        message={`Remove this cancelled class from the day view? It won’t show again. This cannot be undone.`}
        confirmLabel="Delete"
        busy={busy}
        onConfirm={() => void handleDeleteCancelledConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(removeExtraTarget)}
        title="Remove Extra / makeup?"
        message="This deletes the Extra session from your timetable. It won’t show again. This cannot be undone."
        confirmLabel="Remove"
        busy={busy}
        onConfirm={() => void handleRemoveExtraConfirm()}
        onCancel={() => setRemoveExtraTarget(null)}
      />
    </main>
  );
}
