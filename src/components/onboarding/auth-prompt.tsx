"use client";

import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { UserRound } from "lucide-react";

/**
 * Soft, non-blocking nudge to sign in during onboarding.
 * Dexie criteria still save locally without an account.
 */
export function OnboardingAuthPrompt() {
  return (
    <Show when="signed-out">
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-line bg-mist/70 px-3.5 py-3">
        <UserRound
          className="mt-0.5 size-4 shrink-0 text-brand"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Optional account</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
            Sign in so your criteria can travel with your account later. You can
            finish setup without signing in — everything stays on this device
            for now.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <SignInButton mode="modal">
              <button
                type="button"
                className="inline-flex min-h-9 items-center rounded-xl border border-line bg-surface-raised px-3 text-xs font-semibold text-brand-deep transition hover:bg-surface"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="inline-flex min-h-9 items-center rounded-xl bg-brand px-3 text-xs font-semibold text-white transition hover:bg-brand-deep"
              >
                Sign up
              </button>
            </SignUpButton>
          </div>
        </div>
      </div>
    </Show>
  );
}
