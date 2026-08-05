"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InsightPopup } from "@/components/ai/insight-popup";
import { useAiFocusOptional } from "@/components/ai/ai-focus-context";
import { BottomNav } from "@/components/shell/bottom-nav";
import { ClerkAuthControls } from "@/components/shell/clerk-auth-controls";
import { SideNav } from "@/components/shell/side-nav";
import { ThemeToggle } from "@/components/shell/theme-toggle";
type AppFrameProps = {
  children: React.ReactNode;
};

/**
 * Responsive app chrome.
 * Full Agent Control lives on Today / Coach / Analytics pages only.
 * Other pages: subject/class tap → InsightPopup (no chat FAB).
 */
export function AppFrame({ children }: AppFrameProps) {
  const pathname = usePathname();
  const bare = pathname.startsWith("/onboarding");
  const focusCtx = useAiFocusOptional();
  const showInsightPopup = Boolean(focusCtx?.insightOpen && focusCtx?.focus);

  if (bare) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        <div className="flex items-center justify-end gap-2 px-4 pt-3">
          <ClerkAuthControls />
          <ThemeToggle />
        </div>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1200px]">
      <SideNav />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line/60 bg-surface/90 px-4 py-2.5 backdrop-blur-md md:hidden">
          <Link href="/" className="min-w-0 truncate pr-2">
            <p className="font-display text-lg font-semibold tracking-tight text-ink">
              Attendly
            </p>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ClerkAuthControls />
            <ThemeToggle className="shrink-0" />
          </div>
        </header>
        <div className="flex-1 pb-[calc(var(--nav-h)+1.25rem)] md:pb-6">
          {children}
        </div>
        <BottomNav />
        {showInsightPopup ? <InsightPopup /> : null}
      </div>
    </div>
  );
}
