"use client";

import { useRef, useState } from "react";

/**
 * Export / import schedule & settings (no attendance marks).
 * PDF summary stays a separate Settings card.
 */
export function ScheduleBackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const { downloadScheduleBackup } = await import("@/lib/db/export-import");
      const filename = await downloadScheduleBackup();
      setMessage(
        `Downloaded ${filename} — schedule & settings only (no marks).`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not export schedule backup.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const raw = await file.text();
      const { parseBackupJson, importBackup } = await import(
        "@/lib/db/export-import"
      );
      // Validate before confirm so wrong files fail early.
      const payload = parseBackupJson(raw);

      const ok = window.confirm(
        "Replace schedule & settings on this account?\n\n" +
          "Subjects, timetable, exceptions, calendar blocks, and settings will be replaced " +
          "on this device and synced to the cloud. " +
          "All attendance marks will be cleared. This cannot be undone.",
      );
      if (!ok) {
        setMessage("Import cancelled.");
        return;
      }

      await importBackup(payload);
      setMessage("Schedule imported and saved to the cloud — reloading…");
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not import that file. Use an Attendly schedule export (.json).",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="rise rise-delay-2 rounded-2xl border border-line bg-surface-raised px-4 py-4 md:col-span-2">
      <h2 className="font-display text-lg font-semibold text-ink">
        Export / Import schedule
      </h2>
      <p className="mt-1 text-sm text-mute">
        Move timetable, subjects, semester range, period slots, exceptions, and
        calendar blocks between browsers or friends.{" "}
        <span className="font-medium text-ink">Attendance marks are not included</span>{" "}
        — import clears present/absent. After import, Attendly{" "}
        <span className="font-medium text-ink">saves the schedule to your cloud account</span>{" "}
        (Supabase) so other devices see it after sign-in. If cloud save fails,
        you’ll see an error (local Dexie may still hold the import until you retry).
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleExport()}
          className="rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60 sm:flex-1"
        >
          {busy ? "Working…" : "Export schedule & settings (no marks)"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border border-line bg-mist py-3 text-sm font-semibold text-brand-deep disabled:opacity-60 sm:flex-1"
        >
          Import schedule & settings
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Pick Attendly schedule backup JSON"
          onChange={(e) =>
            void handleImportFile(e.target.files?.[0] ?? undefined)
          }
        />
      </div>

      <p className="mt-3 text-xs text-mute">
        Import replaces structure, clears marks, and pushes to the cloud for your
        signed-in account. For a printed attendance summary with marks, use
        Download attendance PDF above.
      </p>

      {message ? (
        <p className="mt-3 text-sm text-risk-safe" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-risk-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
