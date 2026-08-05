"use client";

import { useState } from "react";
import type { AttendanceReport } from "@/lib/analytics/attendance-report";
import { buildAttendanceReport } from "@/lib/analytics/attendance-report";
import { renderReportHtml } from "@/lib/analytics/attendance-report-html";

export { renderReportHtml } from "@/lib/analytics/attendance-report-html";

type Variant = "primary" | "secondary" | "link";

type AttendanceReportButtonProps = {
  label?: string;
  className?: string;
  variant?: Variant;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60",
  secondary:
    "min-h-11 rounded-xl border border-line bg-mist px-4 text-sm font-semibold text-brand hover:bg-mist/80 disabled:opacity-60",
  link: "text-sm font-medium text-brand hover:underline disabled:opacity-60",
};

/** Loads Dexie → opens print-friendly HTML (browser Save as PDF). */
export function AttendanceReportButton({
  label = "Download attendance PDF",
  className,
  variant = "secondary",
}: AttendanceReportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const report = await buildAttendanceReport();
      openPrintWindow(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        className={className ?? VARIANT_CLASS[variant]}
      >
        {busy ? "Building report…" : label}
      </button>
      {error ? <p className="text-xs text-risk-danger">{error}</p> : null}
    </div>
  );
}

/** @deprecated Prefer AttendanceReportButton */
export function PrintReportButton({
  label = "Print / PDF report",
}: {
  semesterName?: string;
  targetPct?: number;
  streaks?: unknown;
  weekday?: unknown;
  subjects?: unknown;
  label?: string;
}) {
  return <AttendanceReportButton label={label} variant="secondary" />;
}

export function openPrintWindow(report: AttendanceReport) {
  const win = window.open(
    "",
    "_blank",
    "noopener,noreferrer,width=880,height=960",
  );
  if (!win) {
    printViaIframe(report);
    return;
  }
  win.document.write(renderReportHtml(report));
  win.document.close();
}

function printViaIframe(report: AttendanceReport) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }
  doc.open();
  doc.write(renderReportHtml(report));
  doc.close();
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
}
