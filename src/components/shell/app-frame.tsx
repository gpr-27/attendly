"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { InsightPopup } from "@/components/ai/insight-popup";
import { useAiFocusOptional } from "@/components/ai/ai-focus-context";
import { BottomNav } from "@/components/shell/bottom-nav";
import { ClerkAuthControls } from "@/components/shell/clerk-auth-controls";
import { SideNav } from "@/components/shell/side-nav";
import { ThemeToggle } from "@/components/shell/theme-toggle";

type AppFrameProps = {
  children: React.ReactNode;
};

function isBarePath(pathname: string) {
  return (
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up")
  );
}

/**
 * Responsive app chrome.
 * Signed-out: no nav shell (landing / sign-in / sign-up own their chrome).
 * Signed-in: side + bottom nav; onboarding stays bare.
 */
export function AppFrame({ children }: AppFrameProps) {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const focusCtx = useAiFocusOptional();
  const showInsightPopup = Boolean(focusCtx?.insightOpen && focusCtx?.focus);

  // Avoid signed-out shell flash while Clerk hydrates; keep layout neutral until loaded.
  if (!isLoaded) {
    return <div className="min-h-dvh w-full">{children}</div>;
  }

  const bare = isBarePath(pathname) || !isSignedIn;

  if (bare) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        {pathname.startsWith("/onboarding") ? (
          <div className="flex items-center justify-end gap-3 px-4 pt-3">
            <ThemeToggle />
            <ClerkAuthControls />
          </div>
        ) : null}
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
