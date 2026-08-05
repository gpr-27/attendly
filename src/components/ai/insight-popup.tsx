"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { SubjectInsightCards } from "@/components/ai/subject-insight-cards";
import { useAiFocusOptional } from "@/components/ai/ai-focus-context";
import { buildInsightCards, buildInsightTip } from "@/lib/ai/ai-focus";
import { cn } from "@/lib/utils/cn";

type InsightPopupProps = {
  className?: string;
};

/**
 * Focused subject/class insight panel — cards + tip, no chat.
 * Opens when AiFocusProvider.requestFocus(..., { ui: "insight" }).
 */
export function InsightPopup({ className }: InsightPopupProps) {
  const focusCtx = useAiFocusOptional();
  const closeRef = useRef<HTMLButtonElement>(null);
  const focus = focusCtx?.focus ?? null;
  const open = Boolean(focusCtx?.insightOpen && focus);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        focusCtx?.clearFocus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, focusCtx]);

  if (!open || !focus || !focusCtx) return null;

  const cards = buildInsightCards(focus);
  const tip = buildInsightTip(focus);
  const title =
    focus.kind === "subject"
      ? focus.name
      : `${focus.name} · ${focus.startLabel}–${focus.endLabel}`;
  const subtitle =
    focus.kind === "subject"
      ? focus.shortCode &&
        focus.shortCode.toLowerCase() !== focus.name.toLowerCase()
        ? focus.shortCode
        : null
      : [
          focus.shortCode &&
          focus.shortCode.toLowerCase() !== focus.name.toLowerCase()
            ? focus.shortCode
            : null,
          focus.ymd,
        ]
          .filter(Boolean)
          .join(" · ") || null;

  function close() {
    focusCtx?.clearFocus();
  }

  return (
    <div
      className={cn("fixed inset-0 z-50", className)}
      role="dialog"
      aria-modal
      aria-labelledby="insight-popup-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        aria-label="Close insight"
        onClick={close}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl border border-line bg-surface p-4 shadow-xl safe-area-pb sm:inset-x-auto sm:bottom-auto sm:top-[16%] sm:left-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
              Insights
            </p>
            <h2
              id="insight-popup-title"
              className="font-display mt-0.5 truncate text-lg font-semibold text-ink"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="truncate text-sm text-mute">{subtitle}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-mute hover:bg-mist hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <SubjectInsightCards cards={cards} />
        <p className="mt-3 rounded-xl bg-mist/70 px-3 py-2.5 text-sm leading-snug text-ink-soft">
          {tip}
        </p>
        <p className="mt-3 text-xs text-mute">
          Want a fuller chat?{" "}
          <Link
            href="/insights"
            onClick={close}
            className="font-semibold text-brand hover:underline"
          >
            Ask more on Coach →
          </Link>
        </p>
      </div>
    </div>
  );
}
