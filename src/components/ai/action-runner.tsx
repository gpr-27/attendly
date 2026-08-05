"use client";

import {
  describeAttendlyAction,
  executeAttendlyAction,
  isDestructiveAction,
  type AttendlyAction,
  type AttendlyActionResult,
} from "@/lib/ai/actions";
import { cn } from "@/lib/utils/cn";

type ActionRunnerProps = {
  actions: AttendlyAction[];
  /** Results already applied (auto-run). */
  results?: AttendlyActionResult[];
  /** Pending destructive actions awaiting confirm. */
  pending?: AttendlyAction[];
  busy?: boolean;
  onConfirm: (action: AttendlyAction) => void;
  onDismiss?: (action: AttendlyAction) => void;
  className?: string;
};

/**
 * Renders proposed Dexie actions: auto-run summaries + confirm chips for deletes.
 */
export function ActionRunner({
  actions,
  results = [],
  pending = [],
  busy,
  onConfirm,
  onDismiss,
  className,
}: ActionRunnerProps) {
  if (actions.length === 0 && results.length === 0 && pending.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {results.map((r, i) => (
        <p
          key={`r-${i}-${r.type}`}
          className={cn(
            "rounded-xl px-3 py-2 text-sm font-medium",
            r.ok
              ? "bg-risk-safe-bg text-risk-safe"
              : "bg-risk-danger-bg text-risk-danger",
          )}
        >
          {r.ok ? `Done: ${r.message}` : `Failed: ${r.message}`}
        </p>
      ))}

      {pending.map((action, i) => (
        <div
          key={`p-${i}-${action.type}`}
          className="rounded-xl border border-risk-danger/30 bg-risk-danger-bg/40 px-3 py-2.5"
        >
          <p className="text-sm font-semibold text-ink">
            Confirm {describeAttendlyAction(action)}?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm(action)}
              className="min-h-10 rounded-full bg-risk-danger px-3.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Confirm
            </button>
            {onDismiss ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onDismiss(action)}
                className="min-h-10 rounded-full border border-line px-3.5 text-xs font-semibold text-ink-soft"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {actions
        .filter((a) => !isDestructiveAction(a) && !pending.includes(a))
        .map((action, i) => (
          <p
            key={`a-${i}-${action.type}`}
            className="rounded-xl border border-line/70 bg-mist/50 px-3 py-2 text-xs text-mute"
          >
            {describeAttendlyAction(action)}
          </p>
        ))}
    </div>
  );
}

/** Run non-destructive immediately; return destructive for confirm UI. */
export async function splitAndRunActions(actions: AttendlyAction[]): Promise<{
  results: AttendlyActionResult[];
  pending: AttendlyAction[];
}> {
  const results: AttendlyActionResult[] = [];
  const pending: AttendlyAction[] = [];
  for (const action of actions) {
    if (isDestructiveAction(action)) {
      pending.push(action);
      continue;
    }
    try {
      results.push(await executeAttendlyAction(action));
    } catch (e) {
      results.push({
        ok: false,
        type: action.type,
        message: e instanceof Error ? e.message : "Action failed",
      });
    }
  }
  return { results, pending };
}
