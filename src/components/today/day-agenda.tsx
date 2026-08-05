"use client";

import { useCallback, useEffect, useState } from "react";
import { AgendaList } from "@/components/today/agenda-list";
import { DayNavigator } from "@/components/calendar/day-navigator";
import { ConfirmDialog } from "@/components/timetable/confirm-dialog";
import { MoveClassDialog } from "@/components/timetable/move-class-dialog";
import { useAiFocus } from "@/components/ai/ai-focus-context";
import {
  clearDayHoliday,
  loadDayAgenda,
  markDaySession,
  undoDaySession,
} from "@/lib/today/load-day-agenda";
import {
  deleteCancelledOccurrence,
  markDateAsHoliday,
  moveSessionOccurrence,
  removeExtraSession,
  type MoveSessionScope,
} from "@/lib/timetable";
import type { AgendaClass, MarkStatus } from "@/lib/today-types";
import { cn } from "@/lib/utils/cn";

type DayAgendaProps = {
  ymd: string;
  onYmdChange?: (ymd: string) => void;
  /** Show prev/next + date picker above the list. */
  showNavigator?: boolean;
  /** Optional header actions (e.g. mark all present). */
  headerActions?: React.ReactNode;
  className?: string;
  /** Called after marks change (parent can refresh month dots). */
  onChanged?: () => void;
  /** Controlled active row. */
  activeId?: string | null;
  onActiveIdChange?: (id: string | null) => void;
};

/**
 * Full day class list + one-tap mark/change.
 * Shared by Today and Calendar — Dexie only, no fake sessions.
 */
export function DayAgenda({
  ymd,
  onYmdChange,
  showNavigator = true,
  headerActions,
  className,
  onChanged,
  activeId: controlledActive,
  onActiveIdChange,
}: DayAgendaProps) {
  const { requestFocus } = useAiFocus();
  const [items, setItems] = useState<AgendaClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dayLabel, setDayLabel] = useState("");
  const [holidayBlocked, setHolidayBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [internalActive, setInternalActive] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<AgendaClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgendaClass | null>(null);
  const [removeExtraTarget, setRemoveExtraTarget] =
    useState<AgendaClass | null>(null);

  const activeId =
    typeof controlledActive === "string" || controlledActive === null
      ? controlledActive
      : internalActive;

  const setActiveId = (id: string | null) => {
    onActiveIdChange?.(id);
    if (controlledActive === undefined) setInternalActive(id);
  };

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = await loadDayAgenda(ymd);
      setItems(result.items);
      setDayLabel(result.dayLabel);
      setHolidayBlocked(result.holidayBlocked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load day");
    } finally {
      setLoading(false);
    }
  }, [ymd]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  async function handleMark(
    id: string,
    status: Exclude<MarkStatus, "unmarked">,
  ) {
    setSuccess(null);
    try {
      await markDaySession(id, status);
      await refresh();
      onChanged?.();
      if (status === "cancelled") {
        setSuccess("Class cancelled for this date.");
      } else if (status === "holiday") {
        setSuccess("Day marked as holiday.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark");
    }
  }

  async function handleUndo(id: string) {
    setSuccess(null);
    try {
      await undoDaySession(id);
      await refresh();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo");
    }
  }

  async function handleMarkHoliday() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await markDateAsHoliday(ymd, "Holiday");
      await refresh();
      onChanged?.();
      setSuccess("Day marked as holiday — teaching suppressed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark holiday");
    } finally {
      setBusy(false);
    }
  }

  async function handleClearHoliday() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await clearDayHoliday(ymd);
      await refresh();
      onChanged?.();
      setSuccess("Holiday cleared.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear holiday");
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
        sessionId: moveTarget.id,
        ...input,
      });
      setMoveTarget(null);
      await refresh();
      onChanged?.();
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

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteCancelledOccurrence(deleteTarget.id);
      setDeleteTarget(null);
      setActiveId(null);
      await refresh();
      onChanged?.();
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
      await removeExtraSession(removeExtraTarget.id);
      setRemoveExtraTarget(null);
      setActiveId(null);
      await refresh();
      onChanged?.();
      setSuccess("Extra / makeup removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove Extra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cn("min-w-0", className)} aria-label={`Agenda ${dayLabel || ymd}`}>
      {showNavigator && onYmdChange ? (
        <div className="mb-4">
          <DayNavigator ymd={ymd} onChange={onYmdChange} />
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Day agenda
          </h2>
          {dayLabel ? (
            <p className="text-xs text-mute">{dayLabel}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
          {holidayBlocked ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleClearHoliday()}
              className="min-h-10 rounded-full px-3 py-2 text-xs font-semibold text-ink-soft ring-1 ring-line disabled:opacity-50"
            >
              Clear holiday
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void handleMarkHoliday()}
              className="min-h-10 rounded-full bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Mark day holiday
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="mb-3 rounded-xl bg-risk-safe-bg px-3 py-2 text-sm text-risk-safe"
        >
          {success}
        </p>
      ) : null}
      {holidayBlocked ? (
        <p className="mb-3 text-sm text-ink-soft">
          Holiday / no-class day — teaching suppressed; % not punished.
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-mute">Loading classes…</p>
      ) : (
        <AgendaList
          items={items}
          activeId={activeId}
          onSelect={(id) => setActiveId(id || null)}
          onMark={handleMark}
          onUndo={handleUndo}
          onMove={(item) => setMoveTarget(item)}
          onDeleteCancelled={(item) => setDeleteTarget(item)}
          onRemoveExtra={(item) => setRemoveExtraTarget(item)}
          askAiLabel="Class insights"
          onAskAi={(item) => {
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
                ymd,
              },
              { ui: "insight" },
            );
          }}
          emptyTitle={
            holidayBlocked
              ? `Holiday — no classes on ${dayLabel || ymd}`
              : `No classes on ${dayLabel || ymd}`
          }
        />
      )}

      <MoveClassDialog
        open={Boolean(moveTarget)}
        sessionId={moveTarget?.id}
        subjectLabel={
          moveTarget
            ? moveTarget.subjectName
            : ""
        }
        initialDate={moveTarget?.ymd ?? ymd}
        initialStart={moveTarget?.startHm ?? "09:00"}
        initialEnd={moveTarget?.endHm ?? "10:00"}
        initialLocation={moveTarget?.location}
        allowPermanent={Boolean(moveTarget?.seriesId)}
        busy={busy}
        onClose={() => setMoveTarget(null)}
        onConfirm={handleMoveConfirm}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete cancelled class?"
        message={`Remove ${deleteTarget?.subjectName ?? "this class"} from this day? It won’t show again. This cannot be undone.`}
        confirmLabel="Delete"
        busy={busy}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(removeExtraTarget)}
        title="Remove Extra / makeup?"
        message={`Remove ${removeExtraTarget?.subjectName ?? "this Extra"} from your timetable? It won’t show again. This cannot be undone.`}
        confirmLabel="Remove"
        busy={busy}
        onConfirm={() => void handleRemoveExtraConfirm()}
        onCancel={() => setRemoveExtraTarget(null)}
      />
    </section>
  );
}

export type { DayAgendaProps };
