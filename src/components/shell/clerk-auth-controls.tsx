"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { attendlyClerkAppearance } from "@/lib/clerk-appearance";
import { cn } from "@/lib/utils/cn";

type ClerkAuthControlsProps = {
  /** Compact row for mobile header; stacked for side nav footer. */
  layout?: "row" | "stack";
  className?: string;
};

/**
 * Clerk sign-in / sign-up / account controls for app chrome.
 * Routes stay public — auth is optional for Dexie-local use.
 */
export function ClerkAuthControls({
  layout = "row",
  className,
}: ClerkAuthControlsProps) {
  return (
    <div
      className={cn(
        layout === "stack"
          ? "flex flex-col gap-2"
          : "flex shrink-0 items-center gap-2",
        className,
      )}
    >
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-semibold transition",
              "border border-line bg-mist text-brand-deep hover:bg-surface-raised",
              layout === "stack" && "w-full min-h-10",
            )}
          >
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-semibold transition",
              "bg-brand text-white hover:bg-brand-deep",
              layout === "stack" && "w-full min-h-10",
            )}
          >
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton
          appearance={{
            ...attendlyClerkAppearance,
            elements: {
              ...attendlyClerkAppearance.elements,
              avatarBox: "size-8 ring-2 ring-brand/25",
            },
          }}
        />
      </Show>
    </div>
  );
}
