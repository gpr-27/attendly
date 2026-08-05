"use client";

import Link from "next/link";
import { useState } from "react";
import { PhotoImport } from "@/components/import/photo-import";
import { FileImport } from "@/components/import/file-import";
import { PreviewEditor } from "@/components/import/preview-editor";
import type { ParseTimetableResult } from "@/lib/ai/schemas";

/** One clean Import flow: photo first, file options collapsed. */
export function ImportPage() {
  const [preview, setPreview] = useState<ParseTimetableResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <main className="w-full max-w-3xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="rise mb-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
          Setup
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Import
        </h1>
        <p className="mt-1.5 text-sm text-mute">
          Photograph your timetable, review the preview, then save to this
          browser. Prefer typing? Use{" "}
          <Link href="/timetable" className="font-medium text-brand hover:underline">
            Timetable
          </Link>
          .
        </p>
      </header>

      {message ? (
        <p className="mb-3 rounded-2xl bg-risk-safe-bg px-3 py-2 text-sm text-risk-safe">
          {message}
        </p>
      ) : null}

      {preview ? (
        <PreviewEditor
          initial={preview}
          onClear={() => setPreview(null)}
          onSaved={(summary) => {
            setPreview(null);
            setMessage(summary ?? "Timetable saved to this device.");
          }}
        />
      ) : (
        <div className="space-y-6">
          <PhotoImport
            onParsed={(result, meta) => {
              setMessage(
                meta?.provider === "groq"
                  ? "Parsed via Groq backup — review before saving."
                  : null,
              );
              setPreview(result);
            }}
          />

          <details className="rounded-2xl border border-line bg-surface-raised px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              Advanced: Excel / CSV / PDF file
            </summary>
            <div className="mt-4 border-t border-line pt-4">
              <FileImport
                onParsed={(result, meta) => {
                  setMessage(
                    meta?.provider
                      ? `Parsed via ${meta.provider} — review before saving.`
                      : meta?.source === "csv" || meta?.source === "excel"
                        ? `Parsed ${meta.source.toUpperCase()} on-device — review before saving.`
                        : null,
                  );
                  setPreview(result);
                }}
              />
            </div>
          </details>
        </div>
      )}

    </main>
  );
}
