"use client";

import { Show, useUser } from "@clerk/nextjs";

/**
 * Auth-aware headline copy for first-run onboarding.
 * Does not gate the form — Dexie remains local for v1.
 */
export function OnboardingIntro() {
  return (
    <header className="rise mb-8">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand">
        Attendly
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-ink">
        Set your bar
      </h1>
      <Show when="signed-out">
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
          Criteria and buffer stay on this device for now. Sign in anytime so
          your account is ready when sync lands. No sample subjects — you add
          the timetable next.
        </p>
      </Show>
      <Show when="signed-in">
        <SignedInIntro />
      </Show>
    </header>
  );
}

function SignedInIntro() {
  const { user } = useUser();
  const first =
    user?.firstName?.trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0];

  return (
    <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
      {first ? `Welcome, ${first}.` : "Welcome."} Your account is ready —
      criteria still live on this device for now (cloud sync comes later). No
      sample subjects — you add the timetable next.
    </p>
  );
}
