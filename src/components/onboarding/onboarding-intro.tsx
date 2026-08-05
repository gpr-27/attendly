"use client";

import { useUser } from "@clerk/nextjs";

/**
 * Headline copy for first-run onboarding (auth required via middleware).
 */
export function OnboardingIntro() {
  const { user } = useUser();
  const first =
    user?.firstName?.trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0];

  return (
    <header className="rise mb-8">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand">
        Attendly
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-ink">
        Set your bar
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        {first ? `Welcome, ${first}.` : "Welcome."} Criteria stay on this
        device for now (cloud sync comes later). No sample subjects — you add
        the timetable next.
      </p>
    </header>
  );
}
