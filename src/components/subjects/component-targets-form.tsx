"use client";

import { useState } from "react";
import {
  updateSubject,
  type AttendanceComponent,
  type ComponentTargets,
  type Subject,
} from "@/lib/db";

const COMPONENTS: { key: AttendanceComponent; label: string }[] = [
  { key: "theory", label: "Theory" },
  { key: "lab", label: "Lab" },
  { key: "tutorial", label: "Tutorial" },
];

type Props = {
  subject: Subject;
  settingsTargetPct: number;
  onSaved: () => void;
};

/**
 * Optional overall + per-component college mins for a subject.
 * Standing math uses component target when set for that session type.
 */
export function ComponentTargetsForm({
  subject,
  settingsTargetPct,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [overall, setOverall] = useState(
    subject.targetPct != null ? String(subject.targetPct) : "",
  );
  const [theory, setTheory] = useState(
    subject.componentTargets?.theory != null
      ? String(subject.componentTargets.theory)
      : "",
  );
  const [lab, setLab] = useState(
    subject.componentTargets?.lab != null
      ? String(subject.componentTargets.lab)
      : "",
  );
  const [tutorial, setTutorial] = useState(
    subject.componentTargets?.tutorial != null
      ? String(subject.componentTargets.tutorial)
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseOptional(raw: string): number | undefined {
    const t = raw.trim();
    if (!t) return undefined;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
    return n;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const componentTargets: ComponentTargets = {};
      const t = parseOptional(theory);
      const l = parseOptional(lab);
      const tu = parseOptional(tutorial);
      if (t != null) componentTargets.theory = t;
      if (l != null) componentTargets.lab = l;
      if (tu != null) componentTargets.tutorial = tu;

      const overallN = parseOptional(overall);
      await updateSubject(subject.id, {
        targetPct: overallN,
        componentTargets:
          Object.keys(componentTargets).length > 0
            ? componentTargets
            : undefined,
      });
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save targets");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs font-medium text-brand hover:underline"
      >
        Component targets
      </button>
    );
  }

  const values: Record<AttendanceComponent, string> = {
    theory,
    lab,
    tutorial,
  };
  const setters: Record<AttendanceComponent, (v: string) => void> = {
    theory: setTheory,
    lab: setLab,
    tutorial: setTutorial,
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-mist/50 p-3">
      <p className="text-xs text-mute">
        Defaults to college {settingsTargetPct}% when blank. Component mins
        apply when slots are theory / lab / tutorial.
      </p>
      <label className="block text-xs font-medium text-mute">
        Overall subject %
        <input
          type="number"
          min={0}
          max={100}
          placeholder={String(settingsTargetPct)}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink"
          value={overall}
          onChange={(e) => setOverall(e.target.value)}
        />
      </label>
      {COMPONENTS.map((c) => (
        <label key={c.key} className="block text-xs font-medium text-mute">
          {c.label} %
          <input
            type="number"
            min={0}
            max={100}
            placeholder="—"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink"
            value={values[c.key]}
            onChange={(e) => setters[c.key](e.target.value)}
          />
        </label>
      ))}
      {error ? <p className="text-xs text-risk-danger">{error}</p> : null}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-mute ring-1 ring-line"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
