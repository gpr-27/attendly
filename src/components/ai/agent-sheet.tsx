"use client";

import { useRef } from "react";
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
  const scrollRootRef = useRef<HTMLDivElement>(null);

  function close() {
    onOpenChange(false);
    focusCtx?.setSheetOpen(false);
  }

  if (!open) return null;

  return (
    <div
      ref={scrollRootRef}
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal
      aria-label="Agent Control"
    >
      <button
        type="button"
        className="sticky top-0 min-h-[8vh] w-full bg-ink/40 backdrop-blur-[2px] md:min-h-[12vh]"
        aria-label="Close agent"
        onClick={close}
      />
      <div
        className={cn(
          "relative -mt-[8vh] min-h-[92vh] bg-surface-raised shadow-xl md:-mt-[12vh] md:mx-auto md:mb-8 md:mt-0 md:max-w-3xl md:min-h-0 md:rounded-2xl md:border md:border-line",
        )}
      >
        <AgentControl
          pageContext={config.pageContext}
          title="Agent Control"
          fill
          autoFocus={!focusCtx?.focus}
          scrollRootRef={scrollRootRef}
          onClose={close}
          onDataChanged={onDataChanged}
          className="rounded-none border-0 shadow-none md:rounded-2xl"
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
