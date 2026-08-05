"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/shell/theme-toggle";

/**
 * Signed-out front page — brand + pitch + auth CTAs.
 * No app shell, no Dexie attendance data.
 */
export function LandingPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-4 pb-10 pt-4">
      <div className="flex items-center justify-end">
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
        <div className="rise">
          <p className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            Attendly
          </p>
          <p className="mt-3 text-lg leading-relaxed text-ink-soft sm:text-xl">
            Your eligibility co-pilot — mark classes, plan bunks, stay above the
            bar.
          </p>
        </div>

        <div className="rise rise-delay-1 mt-10 flex flex-col gap-3">
          <SignInButton mode="modal" forceRedirectUrl="/" fallbackRedirectUrl="/">
            <button
              type="button"
              className="w-full rounded-2xl bg-brand py-4 text-center text-base font-semibold text-white transition hover:bg-brand-deep"
            >
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal" forceRedirectUrl="/" fallbackRedirectUrl="/">
            <button
              type="button"
              className="w-full rounded-2xl border border-line bg-surface-raised py-4 text-center text-base font-semibold text-brand-deep transition hover:bg-mist"
            >
              Sign up
            </button>
          </SignUpButton>
        </div>

        <p className="rise rise-delay-2 mt-8 text-center text-xs leading-relaxed text-mute">
          Attendance stays on this device for now. Sign in to open your
          dashboard — cloud sync comes later.
        </p>
      </div>
    </main>
  );
}
