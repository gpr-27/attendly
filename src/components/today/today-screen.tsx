"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AgendaClass, MarkStatus } from "@/lib/today-types";
import {
  isTodayYmd,
  parseYmd,
  todayYmd,
} from "@/lib/dates";
import {
  clearDayHoliday,
  loadDayAgenda,
  markDaySession,
  undoDaySession,
} from "@/lib/today/load-day-agenda";
import {
  deleteCancelledOccurrence,
  removeExtraSession,
  moveSessionOccurrence,
  type MoveSessionScope,
} from "@/lib/timetable";
import { useTodayNotifications } from "@/lib/notifications";
import { AgendaList } from "@/components/today/agenda-list";
import { AiDock, AiDockTrigger } from "@/components/today/ai-dock";
import { TodayEmptyHub } from "@/components/today/empty-hub";
import { StandingHero } from "@/components/today/standing-hero";
import { DayNavigator } from "@/components/calendar/day-navigator";
import { AttendanceReportButton } from "@/components/analytics/print-report";
import { ConfirmDialog } from "@/components/timetable/confirm-dialog";
import { MoveClassDialog } from "@/components/timetable/move-class-dialog";
import { useAiFocus } from "@/components/ai/ai-focus-context";
import {
  loadSubjectStandings,
  type SubjectStandingRow,
} from "@/lib/attendance";

function initialYmdFromUrl(): string {
  if (typeof window === "undefined") return todayYmd();
  const params = new URLSearchParams(window.location.search);
  return parseYmd(params.get("date")) ?? todayYmd();
}

export function TodayScreen() {
  const router = useRouter();
  const { requestFocus, sheetOpen } = useAiFocus();
  useTodayNotifications(true);
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [loading, setLoading] = useState(true);
  const [targetPct, setTargetPct] = useState(75);
  const [bufferPct, setBufferPct] = useState(0);
  const [dayLabel, setDayLabel] = useState("");
  const [items, setItems] = useState<AgendaClass[]>([]);
  const [subjectCount, setSubjectCount] = useState(0);
  const [seriesCount, setSeriesCount] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectStandingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [holidayBlocked, setHolidayBlocked] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const [moveTarget, setMoveTarget] = useState<AgendaClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgendaClass | null>(null);
  const [removeExtraTarget, setRemoveExtraTarget] =
    useState<AgendaClass | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    setSelectedYmd(initialYmdFromUrl());
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (sheetOpen) setCoachOpen(true);
  }, [sheetOpen]);

  const refresh = useCallback(async () => {
    setError(null);
    const result = await loadDayAgenda(selectedYmd);
    if (!result.onboarded) {
      router.replace("/onboarding");
      return;
    }

    setTargetPct(result.targetPct);
    setBufferPct(result.bufferPct);
    setDayLabel(result.dayLabel);
    setSubjectCount(result.subjectCount);
    setSeriesCount(result.seriesCount);
    setHolidayBlocked(result.holidayBlocked);
    setItems(result.items);
    try {
      const standing = await loadSubjectStandings();
      setSubjects(standing.rows);
      setTargetPct(standing.targetPct);
      setBufferPct(standing.bufferPct);
    } catch {
      setSubjects([]);
    }
    setLoading(false);

    if (isTodayYmd(selectedYmd)) {
      void import("@/lib/notifications")
        .then(({ syncTodayNotifications }) => syncTodayNotifications())
        .catch(() => {
          /* never break Today */
        });
    }
  }, [router, selectedYmd]);

  useEffect(() => {
    if (!urlReady) return;
    setLoading(true);
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load Today");
      setLoading(false);
    });
  }, [refresh, urlReady]);

  function selectDay(ymd: string) {
    setSelectedYmd(ymd);
    setActiveId(null);
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    params.delete("action");
    if (ymd === todayYmd()) params.delete("date");
    else params.set("date", ymd);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }

  /** PWA / deep link: `/?action=mark-next` focuses next unmarked class. */
  useEffect(() => {
    if (loading || !urlReady) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") !== "mark-next") return;

    const nowMs = Date.now();
    const upcoming = items.find(
      (item) => item.status === "unmarked" && item.endsAtMs >= nowMs,
    );
    const target =
      upcoming ?? items.find((item) => item.status === "unmarked");

    if (target) {
      setActiveId(target.id);
      requestAnimationFrame(() => {
        document
          .getElementById(`agenda-${target.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

    const next = new URLSearchParams(params);
    next.delete("action");
    const date = next.get("date");
    router.replace(date ? `/?date=${date}` : "/", { scroll: false });
  }, [loading, items, router, urlReady]);

  async function handleMark(
    id: string,
    status: Exclude<MarkStatus, "unmarked">,
  ) {
    setError(null);
    setSuccess(null);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    try {
      await markDaySession(id, status);
      void refresh();
      if (status === "cancelled") {
        setSuccess("Class cancelled for this date — won’t count toward %.");
      } else if (status === "holiday") {
        setSuccess("Day marked as holiday — teaching suppressed.");
      }
    } catch (err) {
      void refresh();
      setError(err instanceof Error ? err.message : "Could not save mark");
    }
  }

  async function handleUndo(id: string) {
    setError(null);
    setSuccess(null);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "unmarked" as const } : item,
      ),
    );
    try {
      await undoDaySession(id);
      void refresh();
      setSuccess("Mark cleared.");
    } catch (err) {
      void refresh();
      setError(err instanceof Error ? err.message : "Could not undo");
    }
  }

  async function handleClearHoliday() {
    setError(null);
    setSuccess(null);
    try {
      await clearDayHoliday(selectedYmd);
      await refresh();
      setSuccess("Holiday cleared — classes rematerialized.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not clear holiday",
      );
    }
  }

  async function handleMarkAllPresent() {
    const unmarked = items.filter((item) => item.status === "unmarked");
    if (unmarked.length === 0) return;
    setError(null);
    const unmarkedIds = new Set(unmarked.map((item) => item.id));
    setItems((prev) =>
      prev.map((item) =>
        unmarkedIds.has(item.id) ? { ...item, status: "present" as const } : item,
      ),
    );
    try {
      for (const item of unmarked) {
        await markDaySession(item.id, "present");
      }
      void refresh();
    } catch (err) {
      void refresh();
      setError(
        err instanceof Error ? err.message : "Could not mark all present",
      );
    }
  }

  function askAiAboutClass(item: AgendaClass) {
    requestFocus(
      {
        kind: "session",
        sessionId: item.id,
        shortCode: item.shortCode,
        name: item.subjectName,
        percentage: item.pct,
        risk: item.risk,
        impactLine: item.impactLine,
        startLabel: item.startLabel,
        endLabel: item.endLabel,
        ymd: selectedYmd,
      },
      { ui: "coach", openSheet: true },
    );
    setCoachOpen(true);
  }

  async function handleMoveConfirm(input: {
    newDate: string;
    startTime: string;
    endTime: string;
    location?: string;
    scope: MoveSessionScope;
  }) {
    if (!moveTarget) return;
    setActionBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await moveSessionOccurrence({
        sessionId: moveTarget.id,
        ...input,
      });
      setMoveTarget(null);
      await refresh();
      setSuccess(
        result.mode === "entire_pattern"
          ? "Every week (permanent) slot updated."
          : `This date only — moved to ${result.toDate} ${input.startTime}–${input.endTime}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move class");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setActionBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteCancelledOccurrence(deleteTarget.id);
      setDeleteTarget(null);
      setActiveId(null);
      await refresh();
      setSuccess("Cancelled class removed from day view.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRemoveExtraConfirm() {
    if (!removeExtraTarget) return;
    setActionBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await removeExtraSession(removeExtraTarget.id);
      setRemoveExtraTarget(null);
      setActiveId(null);
      await refresh();
      setSuccess("Extra / makeup removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove Extra");
    } finally {
      setActionBusy(false);
    }
  }

  const now = Date.now();
  const viewingToday = isTodayYmd(selectedYmd);
  const unmarkedPast = viewingToday
    ? items.filter(
        (item) => item.status === "unmarked" && item.endsAtMs < now,
      )
    : [];
  const unmarkedCount = items.filter(
    (item) => item.status === "unmarked",
  ).length;
  const showCatchUp = unmarkedPast.length > 0 && !loading;
  const isEmptySetup = !loading && items.length === 0 && seriesCount === 0;

  if (loading || !urlReady) {
    return (
      <main className="px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <p className="text-sm text-mute">Loading Today…</p>
      </main>
    );
  }

  return (
    <main className="px-4 pb-6 pt-6 sm:px-6 lg:px-8">
      <header className="rise mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand md:hidden">
            Attendly
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {viewingToday ? "Today" : "Day view"}
          </h1>
          <p className="mt-1 text-sm text-mute">{dayLabel}</p>
        </div>
        <AiDockTrigger onClick={() => setCoachOpen(true)} />
      </header>

      <div className="rise mb-5">
        <DayNavigator ymd={selectedYmd} onChange={selectDay} />
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-risk-danger/30 bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="mb-4 rounded-xl border border-risk-safe/30 bg-risk-safe-bg px-3 py-2 text-sm text-risk-safe"
        >
          {success}
        </p>
      ) : null}
      {holidayBlocked ? (
        <section className="mb-4 rounded-2xl border border-line bg-mist/60 px-4 py-3">
          <p className="text-sm font-semibold text-ink">Holiday / no class</p>
          <p className="mt-0.5 text-xs text-mute">
            Teaching is suppressed for {dayLabel}. Attendance % is not punished.
          </p>
          <button
            type="button"
            onClick={() => void handleClearHoliday()}
            className="mt-2 min-h-10 text-xs font-semibold text-brand hover:underline"
          >
            Clear one-day holiday
          </button>
        </section>
      ) : null}

      {isEmptySetup ? (
        <TodayEmptyHub
          dayLabel={dayLabel}
          targetPct={targetPct}
          onAskCoach={() => setCoachOpen(true)}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-4">
            <StandingHero
              subjects={subjects}
              targetPct={targetPct}
              bufferPct={bufferPct}
            />
            <AttendanceReportButton
              label="Download attendance PDF"
              variant="secondary"
              className="w-full min-h-11 rounded-xl border border-line bg-mist px-4 text-sm font-semibold text-brand hover:bg-mist/80 disabled:opacity-60"
            />
            {showCatchUp ? (
              <section className="rise rise-delay-1 rounded-2xl border border-risk-watch/40 bg-risk-watch-bg px-3.5 py-3">
                <p className="text-sm font-semibold text-risk-watch">
                  Unmarked catch-up
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {unmarkedPast.length} class
                  {unmarkedPast.length === 1 ? "" : "es"} still open — tap to
                  mark.
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {unmarkedPast.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(item.id)}
                        className="min-h-10 rounded-full border border-risk-watch/45 bg-surface-raised px-3 py-2 text-xs font-medium text-ink hover:border-risk-watch/70"
                      >
                        {item.subjectName} · {item.startLabel}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {subjectCount === 0 ? (
              <p className="text-xs text-mute">
                Tip: add subjects via{" "}
                <Link href="/timetable" className="text-brand hover:underline">
                  Timetable
                </Link>{" "}
                or{" "}
                <Link href="/import" className="text-brand hover:underline">
                  Import
                </Link>
                .
              </p>
            ) : null}
          </div>

          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">
                Agenda
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {unmarkedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleMarkAllPresent()}
                    className="min-h-10 rounded-full bg-risk-safe px-3 py-2 text-xs font-semibold text-white"
                  >
                    Mark all present
                  </button>
                ) : null}
                <Link
                  href="/timetable"
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Edit timetable
                </Link>
                <Link
                  href={`/calendar?date=${selectedYmd}`}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Month
                </Link>
              </div>
            </div>
            <AgendaList
              items={items}
              activeId={activeId}
              onSelect={(id) => setActiveId(id || null)}
              onMark={handleMark}
              onUndo={handleUndo}
              onMove={(item) => setMoveTarget(item)}
              onDeleteCancelled={(item) => setDeleteTarget(item)}
              onRemoveExtra={(item) => setRemoveExtraTarget(item)}
              onAskAi={askAiAboutClass}
              askAiLabel="Ask AI"
              emptyTitle={
                holidayBlocked
                  ? `Holiday — no classes on ${dayLabel}`
                  : `No classes on ${dayLabel}`
              }
            />
            {bufferPct > 0 ? (
              <p className="mt-4 text-center text-xs text-mute lg:text-left">
                Personal buffer +{bufferPct}% on top of {targetPct}%
              </p>
            ) : null}
          </section>
        </div>
      )}


      <AiDock
        open={coachOpen}
        onOpenChange={setCoachOpen}
        onDataChanged={() => void refresh()}
      />

      <MoveClassDialog
        open={Boolean(moveTarget)}
        sessionId={moveTarget?.id}
        subjectLabel={
          moveTarget
            ? moveTarget.subjectName
            : ""
        }
        initialDate={moveTarget?.ymd ?? selectedYmd}
        initialStart={moveTarget?.startHm ?? "09:00"}
        initialEnd={moveTarget?.endHm ?? "10:00"}
        initialLocation={moveTarget?.location}
        allowPermanent={Boolean(moveTarget?.seriesId)}
        busy={actionBusy}
        onClose={() => setMoveTarget(null)}
        onConfirm={handleMoveConfirm}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete cancelled class?"
        message={`Remove ${deleteTarget?.subjectName ?? "this class"} from this day? It won’t show again. This cannot be undone.`}
        confirmLabel="Delete"
        busy={actionBusy}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(removeExtraTarget)}
        title="Remove Extra / makeup?"
        message={`Remove ${removeExtraTarget?.subjectName ?? "this Extra"} from your timetable? It won’t show again. This cannot be undone.`}
        confirmLabel="Remove"
        busy={actionBusy}
        onConfirm={() => void handleRemoveExtraConfirm()}
        onCancel={() => setRemoveExtraTarget(null)}
      />
    </main>
  );
}
