"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { AgentControl } from "@/components/ai/agent-control";
import { useAiFocusOptional } from "@/components/ai/ai-focus-context";
import { getPageAiByKey, type PageAiKey } from "@/lib/ai/page-ai-config";
import { cn } from "@/lib/utils/cn";

type AgentSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageKey: Extract<PageAiKey, "today" | "insights" | "analytics">;
  onDataChanged?: () => void;
};

/**
 * ChatGPT-style Agent Control — full viewport on phone, large centered
 * full-height panel on laptop. Messages scroll inside; composer stays pinned.
 */
export function AgentSheet({
  open,
  onOpenChange,
  pageKey,
  onDataChanged,
}: AgentSheetProps) {
  const focusCtx = useAiFocusOptional();
  const config = getPageAiByKey(pageKey);
  const panelRef = useRef<HTMLDivElement>(null);

  function close() {
    onOpenChange(false);
    focusCtx?.setSheetOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close closes over latest focusCtx
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/45 backdrop-blur-[2px] md:items-center md:p-4"
      role="dialog"
      aria-modal
      aria-label="Agent Control"
    >
      {/* Desktop click-outside to close */}
      <button
        type="button"
        className="absolute inset-0 hidden md:block"
        aria-label="Close agent"
        onClick={close}
      />

      <div
        ref={panelRef}
        className={cn(
          "relative z-[1] flex h-dvh w-full max-w-3xl flex-col overflow-hidden bg-surface-raised shadow-xl",
          "md:h-[min(92dvh,56rem)] md:rounded-2xl md:border md:border-line",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <AgentControl
          pageContext={config.pageContext}
          title="Agent Control"
          fill
          autoFocus={!focusCtx?.focus}
          onClose={close}
          onDataChanged={onDataChanged}
          className="h-full min-h-0 rounded-none border-0 shadow-none md:rounded-2xl"
        />
      </div>
    </div>
  );
}

type AgentFabProps = {
  onClick: () => void;
  className?: string;
  /** Header-style pill (Today) vs floating FAB. */
  variant?: "pill" | "fab";
};

export function AgentFab({
  onClick,
  className,
  variant = "fab",
}: AgentFabProps) {
  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3.5 py-2 text-sm font-semibold text-brand transition hover:bg-brand/15",
          className,
        )}
      >
        <Sparkles className="size-4" aria-hidden />
        Agent
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fab-bottom fab-bottom-md-reset fixed right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand/30 bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-deep md:bottom-6",
        className,
      )}
      aria-label="Open Agent"
    >
      <Sparkles className="size-4" aria-hidden />
      Agent
    </button>
  );
}
