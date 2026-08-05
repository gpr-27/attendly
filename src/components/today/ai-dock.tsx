"use client";

import { AgentFab, AgentSheet } from "@/components/ai/agent-sheet";

type AiDockProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDataChanged?: () => void;
  className?: string;
};

/** Today Agent — full-viewport sheet (no half-page dock). */
export function AiDock({ open, onOpenChange, onDataChanged }: AiDockProps) {
  return (
    <AgentSheet
      open={Boolean(open)}
      onOpenChange={(next) => onOpenChange?.(next)}
      pageKey="today"
      onDataChanged={onDataChanged}
    />
  );
}

export function AiDockTrigger({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return <AgentFab variant="pill" onClick={onClick} className={className} />;
}
