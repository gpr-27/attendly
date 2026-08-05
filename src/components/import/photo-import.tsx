"use client";

import { useEffect, useState } from "react";
import type { AiStatus, ParseTimetableResult } from "@/lib/ai/schemas";
import type { ParseProvider } from "@/lib/ai/gemini-timetable";

type PhotoImportProps = {
  onParsed: (
    result: ParseTimetableResult,
    meta?: { provider?: ParseProvider },
  ) => void;
};

type ParseErrorBody = {
  error?: string;
  code?: string;
  hint?: string;
  setupHint?: string;
  retryAfterSeconds?: number;
};

export function PhotoImport({ onParsed }: PhotoImportProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuota, setIsQuota] = useState(false);
  const [setupHint, setSetupHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/status")
      .then((r) => r.json() as Promise<AiStatus>)
      .then((status) => {
        if (cancelled) return;
        if (!status.geminiConfigured && !status.groqConfigured) {
          setSetupHint(
            status.setupHint ??
              "Add GEMINI_API_KEY (and optional GROQ_API_KEY backup) to .env.local. You can still build the timetable manually.",
          );
        } else {
          setSetupHint(null);
        }
      })
      .catch(() => {
        /* optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setIsQuota(false);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/ai/parse-timetable", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as ParseTimetableResult &
        ParseErrorBody & { provider?: ParseProvider };

      if (!res.ok) {
        if (data.code === "missing_key" || res.status === 503) {
          setSetupHint(data.setupHint ?? data.error ?? null);
          throw new Error(
            data.setupHint ?? data.error ?? "AI keys not configured",
          );
        }
        if (data.code === "quota_exceeded" || res.status === 429) {
          setIsQuota(true);
          const parts = [
            data.hint ??
              data.error ??
              "AI quota exhausted. Try again shortly, or add your timetable manually.",
          ];
          if (
            data.retryAfterSeconds != null &&
            !parts[0]?.includes(`${data.retryAfterSeconds}s`)
          ) {
            parts.push(`Retry in about ${data.retryAfterSeconds}s.`);
          }
          throw new Error(parts.filter(Boolean).join(" "));
        }
        throw new Error(data.error ?? `Parse failed (${res.status})`);
      }
      if (!data.subjects?.length) {
        throw new Error("No subjects found in the photo — try a clearer shot.");
      }
      onParsed(
        {
          subjects: data.subjects,
          slots: data.slots,
          notes: data.notes,
        },
        { provider: data.provider },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise rise-delay-2 space-y-4">
      {setupHint ? (
        <div
          className="rounded-[var(--radius)] border border-risk-watch/30 bg-risk-watch-bg px-3 py-3 text-sm text-ink"
          role="status"
        >
          <p className="font-semibold">Photo import needs AI keys</p>
          <p className="mt-1 opacity-90">{setupHint}</p>
          <p className="mt-2 text-mute">
            Timetable, marking, and bunk math still work without keys — use the
            Timetable page or JSON tab.
          </p>
        </div>
      ) : null}
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-line bg-surface-raised px-4 text-center">
        <span className="font-display text-lg text-ink">
          {busy ? "Reading timetable…" : "Choose timetable photo"}
        </span>
        <span className="mt-1 text-sm text-mute">
          Works with grids, messy handwriting, and portal screenshots (room +
          faculty). You confirm before save.
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy || Boolean(setupHint)}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </label>
      {error ? (
        <div
          className={`rounded-[var(--radius)] px-3 py-3 text-sm ${
            isQuota
              ? "border border-risk-watch/30 bg-risk-watch-bg text-ink"
              : "bg-risk-danger-bg text-risk-danger"
          }`}
          role="alert"
        >
          <p className="font-semibold">
            {isQuota ? "AI quota temporarily exhausted" : "Couldn’t parse photo"}
          </p>
          <p className="mt-1 opacity-90">{error}</p>
          {isQuota ? (
            <p className="mt-2 text-mute">
              Wait and retry the photo, or switch to the JSON tab / build the
              timetable manually.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
