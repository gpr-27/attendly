"use client";

import { useEffect, useState } from "react";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import {
  getPageAiByKey,
  type PageAiKey,
} from "@/lib/ai/page-ai-config";
import { cn } from "@/lib/utils/cn";

type PageAiCardProps = {
  pageKey: PageAiKey;
  extraContext?: string;
  className?: string;
};

/**
 * Inline Ask AI card — only when page config enables inlineCard (Analytics).
 * Desktop only; mobile uses shell FAB on the same pages.
 */
export function PageAiCard({
  pageKey,
  extraContext,
  className,
}: PageAiCardProps) {
  const config = getPageAiByKey(pageKey);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setDesktop(mq.matches);
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!config.inlineCard || !desktop) return null;

  return (
    <div className={cn("mt-8", className)}>
      <AiAssistantPanel
        pageKey={pageKey}
        extraContext={extraContext}
        compact
        showModes
      />
    </div>
  );
}
