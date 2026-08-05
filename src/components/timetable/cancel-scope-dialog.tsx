"use client";

import { useEffect, useState } from "react";
import type { Subject, TimetableSeries } from "@/lib/db";
import type { CancelSeriesScope } from "@/lib/timetable";
import {
  MutationScopeRadios,
  type ClassMutationScope,
} from "@/components/timetable/mutation-scope-radios";

type CancelScopeDialogProps = {
  open: boolean;
  slot: TimetableSeries | null;
  subject?: Subject;
  date: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (scope: CancelSeriesScope) => Promise<void>;
};

/**
 * Cancel a class — exactly two scopes:
 * This date only | Every week (remove from permanent pattern).
 */
export function CancelScopeDialog({
  open,
  slot,
  subject,
  date,
  busy,
  onClose,
  onConfirm,
}: CancelScopeDialogProps) {
  const [scope, setScope] = useState<ClassMutationScope>("this_date");

  useEffect(() => {
    if (!open) return;
    setScope("this_date");
  }, [open, slot?.id, date]);

  if (!open || !slot) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-scope-title"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface-raised p-5 shadow-xl ring-1 ring-line safe-area-pb sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="cancel-scope-title"
          className="font-display text-xl font-semibold text-ink"
        >
          Cancel {subject?.name ?? "class"}?
        </h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Date: <span className="font-medium text-ink">{date}</span>
        </p>

        <div className="mt-4">
          <MutationScopeRadios
            name="cancel-scope"
            legend="How far should this cancel apply?"
            value={scope}
            onChange={setScope}
          />
        </div>
        {scope === "entire_pattern" ? (
          <p className="mt-3 text-xs text-risk-danger">
            Every week removes this slot from the original permanent timetable.
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-11 rounded-xl px-4 text-sm font-semibold text-ink-soft ring-1 ring-line disabled:opacity-50"
          >
            Keep class
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm(scope)}
            className="min-h-11 rounded-xl bg-risk-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {scope === "entire_pattern"
              ? "Every week (permanent)"
              : "This date only"}
          </button>
        </div>
      </div>
    </div>
  );
}
