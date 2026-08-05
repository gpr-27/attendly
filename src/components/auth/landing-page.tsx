"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/shell/theme-toggle";

/**
 * Signed-out front page — brand + pitch + auth CTAs.
 * Full-bleed on phone; wide split composition on laptop (not a skinny phone column).
 */
export function LandingPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="safe-area-pt mx-auto flex w-full max-w-6xl items-center justify-end px-5 pt-4 sm:px-8 lg:px-10">
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 py-10 sm:px-8 lg:px-10 lg:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,20rem)] lg:gap-16 xl:gap-20">
          <div className="rise min-w-0">
            <p className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-6xl lg:text-7xl xl:text-8xl">
              Attendly
            </p>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl lg:mt-5 lg:text-2xl lg:leading-snug">
              Your eligibility co-pilot — mark classes, plan bunks, stay above
              the bar.
            </p>
          </div>

          <div className="rise rise-delay-1 flex w-full flex-col gap-3 sm:max-w-md sm:flex-row lg:max-w-none lg:flex-col">
            <SignInButton
              mode="modal"
              forceRedirectUrl="/"
              fallbackRedirectUrl="/"
            >
              <button
                type="button"
                className="min-h-12 w-full flex-1 rounded-2xl bg-brand px-6 py-3.5 text-center text-base font-semibold text-white transition hover:bg-brand-deep sm:py-4"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton
              mode="modal"
              forceRedirectUrl="/"
              fallbackRedirectUrl="/"
            >
              <button
                type="button"
                className="min-h-12 w-full flex-1 rounded-2xl border border-line bg-surface-raised px-6 py-3.5 text-center text-base font-semibold text-brand-deep transition hover:bg-mist sm:py-4"
              >
                Sign up
              </button>
            </SignUpButton>
          </div>
        </div>

        <p className="rise rise-delay-2 mt-10 max-w-xl text-sm leading-relaxed text-mute lg:mt-14">
          Sign in to open your dashboard. Your schedule and marks sync to your
          cloud account (with an offline cache on this device).
        </p>
      </div>
    </main>
  );
}
