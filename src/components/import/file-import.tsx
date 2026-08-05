"use client";

import { useState } from "react";
import type { ParseTimetableResult } from "@/lib/ai/schemas";
import {
  extractPdfText,
  parseTimetableCsv,
  parseTimetableExcel,
  pdfTextLooksUseful,
} from "@/lib/timetable";

type FileImportProps = {
  onParsed: (
    result: ParseTimetableResult,
    meta?: { provider?: string; source: string },
  ) => void;
};

export function FileImport({ onParsed }: FileImportProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const name = file.name.toLowerCase();
      const isCsv =
        name.endsWith(".csv") ||
        file.type === "text/csv" ||
        file.type === "text/plain";
      const isExcel =
        name.endsWith(".xlsx") ||
        name.endsWith(".xls") ||
        file.type.includes("spreadsheet") ||
        file.type.includes("excel");
      const isPdf =
        name.endsWith(".pdf") || file.type === "application/pdf";

      if (isCsv) {
        const text = await file.text();
        const result = parseTimetableCsv(text);
        onParsed(result, { source: "csv" });
        return;
      }

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const result = parseTimetableExcel(buffer);
        onParsed(result, { source: "excel" });
        return;
      }

      if (isPdf) {
        const buffer = await file.arrayBuffer();
        const text = extractPdfText(buffer);
        if (pdfTextLooksUseful(text)) {
          // Prefer AI for messy layouts when keys exist; fall back to raw text API
          try {
            const res = await fetch("/api/ai/parse-timetable-text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text }),
            });
            if (res.ok) {
              const json = (await res.json()) as ParseTimetableResult & {
                provider?: string;
              };
              onParsed(json, {
                provider: json.provider,
                source: "pdf-ai",
              });
              return;
            }
            setHint(
              "AI parse unavailable — paste structured CSV/Excel, or check API keys.",
            );
          } catch {
            setHint("AI parse failed — try CSV/Excel instead.");
          }
        }
        // Last resort: send whatever text we got to AI
        if (text.length >= 40) {
          const res = await fetch("/api/ai/parse-timetable-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(
              body?.error ??
                "Could not parse PDF. Export CSV/Excel from your portal, or use photo import.",
            );
          }
          const json = (await res.json()) as ParseTimetableResult & {
            provider?: string;
          };
          onParsed(json, { provider: json.provider, source: "pdf-ai" });
          return;
        }
        throw new Error(
          "PDF has little extractable text (likely a scan). Use photo import or CSV/Excel.",
        );
      }

      throw new Error("Supported: .csv, .xlsx, .xls, .pdf");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius)] border border-line bg-surface-raised p-4">
      <div>
        <p className="text-sm font-semibold text-ink">Excel / CSV / PDF</p>
        <p className="mt-1 text-xs text-mute">
          CSV & Excel parse on-device. PDF text uses Gemini/Groq when keys exist;
          scanned PDFs work better via Photo.
        </p>
      </div>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface px-4 py-6 text-center">
        <span className="text-sm font-medium text-ink">
          {busy ? "Parsing…" : "Choose file"}
        </span>
        <span className="mt-1 text-xs text-mute">.csv · .xlsx · .pdf</span>
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-[0.7rem] text-mute">
        CSV headers:{" "}
        <code className="text-ink-soft">shortCode,name,day,start,end,location</code>
      </p>
      {hint ? (
        <p className="text-xs text-mute">{hint}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
