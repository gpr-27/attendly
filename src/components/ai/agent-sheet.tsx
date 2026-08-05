"use client";

import { useEffect } from "react";
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
 * Full-viewport Agent Control modal (Today / Coach / Analytics only).
 * Phone = near full screen; laptop = large centered dialog.
 */
export function AgentSheet({
  open,
  onOpenChange,
  pageKey,
  onDataChanged,
}: AgentSheetProps) {
  const focusCtx = useAiFocusOptional();
  const config = getPageAiByKey(pageKey);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    onOpenChange(false);
    focusCtx?.setSheetOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-label="Agent Control">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        aria-label="Close agent"
        onClick={close}
      />
      <div
        className={cn(
          "absolute inset-0 flex flex-col bg-surface-raised shadow-xl",
          "md:inset-4 md:rounded-2xl md:border md:border-line",
          "lg:inset-[5vh_max(1rem,calc((100vw-48rem)/2))] lg:max-h-[90dvh]",
        )}
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
          "inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3.5 py-2 text-sm font-semibold text-brand transition hover:bg-brand/15",
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
        "fixed z-40 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-deep",
        "right-4 bottom-[calc(var(--nav-h)+1rem)] md:bottom-6",
        className,
      )}
      aria-label="Open Agent"
    >
      <Sparkles className="size-4" aria-hidden />
      Agent
    </button>
  );
}
