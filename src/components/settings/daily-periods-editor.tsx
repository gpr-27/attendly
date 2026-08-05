"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultPeriodSlots,
  type PeriodSlot,
} from "@/lib/db";
import {
  validatePeriodSlots,
} from "@/lib/timetable";
import { cn } from "@/lib/cn";

/**
 * Edit the fixed daily period template once in Settings.
 * Quick-add on Timetable picks these chips instead of typing times every class.
 */
export function DailyPeriodsEditor() {
  const [slots, setSlots] = useState<PeriodSlot[]>(defaultPeriodSlots());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const { getSettings } = await import("@/lib/db");
      const settings = await getSettings();
      setSlots(
        settings.periodSlots?.length
          ? settings.periodSlots.map((s) => ({ ...s }))
          : defaultPeriodSlots(),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load periods");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function updateSlot(index: number, patch: Partial<PeriodSlot>) {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
    setMessage(null);
  }

  function addSlot() {
    if (slots.length >= 12) return;
    const n = slots.length + 1;
    setSlots((prev) => [
      ...prev,
      { label: `Slot ${n}`, startTime: "16:00", endTime: "17:00" },
    ]);
    setMessage(null);
  }

  function removeSlot(index: number) {
    if (slots.length <= 1) return;
    setSlots((prev) => prev.filter((_, i) => i !== index));
    setMessage(null);
  }

  async function handleSave() {
    const err = validatePeriodSlots(slots);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { saveSettings } = await import("@/lib/db");
      await saveSettings({ periodSlots: slots });
      setMessage("Daily periods saved. Timetable quick-add will use these.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save periods");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetDefaults() {
    setSlots(defaultPeriodSlots());
    setMessage(null);
    setError(null);
  }

  if (loading) {
    return <p className="text-sm text-mute">Loading periods…</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {slots.map((slot, index) => (
          <li
            key={index}
            className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-mist/50 px-3 py-2.5"
          >
            <label className="min-w-[6.5rem] flex-1 text-xs font-medium text-mute">
              Label
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-line bg-surface-raised px-2.5 py-2 text-sm text-ink"
                value={slot.label}
                onChange={(e) => updateSlot(index, { label: e.target.value })}
                maxLength={24}
              />
            </label>
            <label className="text-xs font-medium text-mute">
              Start
              <input
                type="time"
                className="mt-1 block w-full rounded-lg border border-line bg-surface-raised px-2.5 py-2 text-sm text-ink sm:w-[7.5rem]"
                value={slot.startTime}
                onChange={(e) =>
                  updateSlot(index, { startTime: e.target.value })
                }
              />
            </label>
            <label className="text-xs font-medium text-mute">
              End
              <input
                type="time"
                className="mt-1 block w-full rounded-lg border border-line bg-surface-raised px-2.5 py-2 text-sm text-ink sm:w-[7.5rem]"
                value={slot.endTime}
                onChange={(e) => updateSlot(index, { endTime: e.target.value })}
              />
            </label>
            <button
              type="button"
              disabled={busy || slots.length <= 1}
              onClick={() => removeSlot(index)}
              className={cn(
                "min-h-10 rounded-lg px-2.5 text-xs font-semibold text-risk-danger ring-1 ring-line disabled:opacity-40",
              )}
              aria-label={`Remove ${slot.label}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || slots.length >= 12}
          onClick={addSlot}
          className="min-h-10 rounded-xl border border-line bg-mist px-3 text-sm font-semibold text-brand-deep disabled:opacity-50"
        >
          Add period
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleResetDefaults()}
          className="min-h-10 rounded-xl border border-line bg-mist px-3 text-sm font-semibold text-ink-soft disabled:opacity-50"
        >
          Reset defaults
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="min-h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save periods"}
        </button>
      </div>

      {message ? (
        <p className="text-sm text-risk-safe">{message}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-risk-danger">{error}</p>
      ) : null}
    </div>
  );
}
