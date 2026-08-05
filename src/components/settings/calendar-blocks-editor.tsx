"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addCalendarBlock,
  deleteCalendarBlock,
  listCalendarBlocks,
  type CalendarBlock,
  type CalendarBlockKind,
} from "@/lib/db";
import { ensureSessionsMaterialized } from "@/lib/timetable";

const KINDS: {
  value: CalendarBlockKind;
  label: string;
  defaultSuppress: boolean;
}[] = [
  { value: "ct1", label: "CT1", defaultSuppress: true },
  { value: "ct2", label: "CT2", defaultSuppress: true },
  { value: "exam", label: "Exam", defaultSuppress: true },
  { value: "exam_week", label: "Exam week", defaultSuppress: true },
  { value: "holiday", label: "Holiday", defaultSuppress: true },
  { value: "break", label: "Break", defaultSuppress: true },
];

function defaultTitle(kind: CalendarBlockKind): string {
  return KINDS.find((k) => k.value === kind)?.label ?? "Block";
}

/**
 * Add / list exam-week and holiday ranges.
 * Suppressing blocks are respected by the session materializer.
 */
export function CalendarBlocksEditor() {
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [kind, setKind] = useState<CalendarBlockKind>("ct1");
  const [title, setTitle] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [suppressesTeaching, setSuppressesTeaching] = useState(true);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setBlocks(await listCalendarBlocks());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load blocks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!startsOn || !endsOn) return;
    if (endsOn < startsOn) {
      setError("End date must be on or after start date");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const label = title.trim() || defaultTitle(kind);
      await addCalendarBlock({
        kind,
        title: label,
        startsOn,
        endsOn,
        suppressesTeaching,
      });
      if (suppressesTeaching) {
        try {
          await ensureSessionsMaterialized({
            from: startsOn,
            to: endsOn,
          });
        } catch (matErr) {
          setError(
            matErr instanceof Error
              ? `Saved block, but rematerialize failed: ${matErr.message}`
              : "Saved block, but rematerialize failed.",
          );
          await reload();
          return;
        }
      }
      setTitle("");
      setStartsOn("");
      setEndsOn("");
      setMessage(
        suppressesTeaching
          ? `Saved ${defaultTitle(kind)} — no teaching classes on those dates (rematerialized).`
          : "Saved (teaching still generated on those dates).",
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add block");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await deleteCalendarBlock(id);
      try {
        await ensureSessionsMaterialized();
      } catch (matErr) {
        setError(
          matErr instanceof Error
            ? `Removed block, but rematerialize failed: ${matErr.message}`
            : "Removed block, but rematerialize failed.",
        );
        await reload();
        return;
      }
      setMessage("Removed — sessions rematerialized.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rise rounded-2xl border border-line bg-surface-raised px-4 py-4">
      <h2 className="font-display text-lg font-semibold text-ink">
        Exam, CT & holidays
      </h2>
      <p className="mt-1 text-sm text-mute">
        Mark CT1, CT2, Exam, exam week, holiday, or break inside your semester.
        When “Suppress teaching” is on (default), the materializer skips those
        dates — Timetable / Today show no regular classes.
      </p>

      <form className="mt-4 space-y-3" onSubmit={(e) => void handleAdd(e)}>
        <label className="block text-xs font-medium text-mute">
          Kind
          <select
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink"
            value={kind}
            onChange={(e) => {
              const next = e.target.value as CalendarBlockKind;
              setKind(next);
              const meta = KINDS.find((k) => k.value === next);
              if (meta) setSuppressesTeaching(meta.defaultSuppress);
            }}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-mute">
          Title (optional)
          <input
            type="text"
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Mid-sem exams"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-mute">
            From
            <input
              type="date"
              required
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-mute">
            To
            <input
              type="date"
              required
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={suppressesTeaching}
            onChange={(e) => setSuppressesTeaching(e.target.checked)}
          />
          Suppress teaching (no classes generated)
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Add range
        </button>
      </form>

      {message ? (
        <p className="mt-3 text-sm text-risk-safe">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-risk-danger">{error}</p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-mute">Loading…</p>
      ) : blocks.length === 0 ? (
        <p className="mt-4 text-sm text-mute">No blackout ranges yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {blocks.map((block) => (
            <li
              key={block.id}
              className="flex items-start justify-between gap-3 rounded-xl bg-mist/60 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{block.title}</p>
                <p className="text-xs text-mute">
                  {block.kind} · {block.startsOn} → {block.endsOn}
                  {block.suppressesTeaching ? " · suppresses teaching" : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete(block.id)}
                className="shrink-0 text-xs font-medium text-risk-danger hover:underline disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
