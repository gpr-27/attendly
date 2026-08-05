"use client";

import { useEffect, useState } from "react";
import { applySemesterRange } from "@/lib/timetable";

/**
 * Semester start → end. Saving rematerializes the full range so past weeks
 * (e.g. last week) show classes from the permanent weekly pattern.
 */
export function SemesterRangeEditor() {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { getSettings } = await import("@/lib/db");
      const s = await getSettings();
      setName(s.semesterName ?? "");
      setStart(s.semesterStart ?? "");
      setEnd(s.semesterEnd ?? "");
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await applySemesterRange({
        semesterStart: start,
        semesterEnd: end,
        semesterName: name,
      });
      setMessage(
        `Saved. Materialized ${result.upserted} class(es) across the semester` +
          (result.seriesUpdated
            ? ` · aligned ${result.seriesUpdated} weekly slot(s) to the start date`
            : "") +
          ".",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save semester");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rise rounded-2xl border border-line bg-surface-raised px-4 py-4">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
        Required for Timetable
      </p>
      <h2 className="font-display mt-1 text-lg font-semibold text-ink">
        Semester range
      </h2>
      <p className="mt-1 text-sm text-mute">
        Classes from your permanent weekly timetable are generated for every
        day between start and end (except Exam / CT / holiday blocks below).
        If weeks before today look empty, set start to your real semester first
        day and save — that rematerializes the full term.
      </p>
      <form className="mt-4 space-y-3" onSubmit={(e) => void handleSave(e)}>
        <label className="block text-xs font-medium text-mute">
          Name (optional)
          <input
            type="text"
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Odd semester 2026"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-mute">
            Start date
            <input
              type="date"
              required
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-mute">
            End date
            <input
              type="date"
              required
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy || !start || !end}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving & rematerializing…" : "Save semester & rematerialize"}
        </button>
      </form>
      {message ? (
        <p className="mt-3 text-sm text-risk-safe">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-risk-danger">{error}</p>
      ) : null}
    </section>
  );
}
