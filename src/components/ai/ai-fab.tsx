"use client";

import { useEffect, useRef } from "react";
import { MessageSquareText } from "lucide-react";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { useAiFocusOptional } from "@/components/ai/ai-focus-context";
import type { PageAiKey } from "@/lib/ai/page-ai-config";
import { cn } from "@/lib/utils/cn";

type AiFabProps = {
  pageKey: PageAiKey;
  className?: string;
};

/**
 * Mobile floating Ask AI button + bottom sheet panel.
 * Hidden from md up (pages use inline Ask AI cards on desktop).
 * Opens automatically when AiFocusProvider.requestFocus runs.
 */
export function AiFab({ pageKey, className }: AiFabProps) {
  const focusCtx = useAiFocusOptional();
  const open = focusCtx?.sheetOpen ?? false;
  const scrollRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusCtx?.setSheetOpen(false);
    focusCtx?.clearFocus();
    // Only reset when navigating between pages
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  function setOpen(next: boolean) {
    focusCtx?.setSheetOpen(next);
    if (!next) focusCtx?.clearFocus();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fab-bottom fixed right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand/30 bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-deep md:hidden",
          className,
        )}
        aria-label="Ask AI"
      >
        <MessageSquareText className="size-4" aria-hidden />
        Ask AI
      </button>

      {open ? (
        <div
          ref={scrollRootRef}
          className="fixed inset-0 z-50 overflow-y-auto md:hidden"
          role="dialog"
          aria-modal
        >
          <button
            type="button"
            className="sticky top-0 min-h-[20vh] w-full bg-ink/35 backdrop-blur-[2px]"
            aria-label="Close AI"
            onClick={() => setOpen(false)}
          />
          <div className="relative -mt-[20vh] min-h-[80vh] rounded-t-2xl border border-line bg-surface-raised p-3 shadow-xl safe-area-pb sm:mx-auto sm:mb-4 sm:mt-0 sm:max-w-[min(24rem,calc(100vw-2rem))] sm:rounded-2xl">
            <AiAssistantPanel
              pageKey={pageKey}
              compact
              autoFocus={!focusCtx?.focus}
              scrollRootRef={scrollRootRef}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
