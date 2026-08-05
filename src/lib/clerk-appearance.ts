import type { ClerkAppearanceTheme } from "@clerk/shared/types";

/**
 * Attendly teal / daylight tokens for Clerk modals + UserButton.
 * Uses CSS vars so light/dark theme switches track `html[data-theme]`.
 */
export const attendlyClerkAppearance = {
  variables: {
    colorPrimary: "var(--brand)",
    colorPrimaryForeground: "#ffffff",
    colorForeground: "var(--ink)",
    colorMutedForeground: "var(--mute)",
    colorMuted: "var(--mist)",
    colorBackground: "var(--surface-raised)",
    colorInput: "var(--surface)",
    colorInputForeground: "var(--ink)",
    colorBorder: "var(--line)",
    colorRing: "var(--brand)",
    colorNeutral: "var(--ink-soft)",
    colorDanger: "var(--risk-danger)",
    colorSuccess: "var(--risk-safe)",
    colorWarning: "var(--risk-watch)",
    colorModalBackdrop: "rgba(10, 16, 24, 0.55)",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    fontFamilyButtons: "var(--font-dm-sans), system-ui, sans-serif",
  },
  elements: {
    formButtonPrimary:
      "bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white shadow-none",
    footerActionLink:
      "text-[var(--brand)] hover:text-[var(--brand-deep)]",
    headerTitle: "text-[var(--ink)] font-[family-name:var(--font-fraunces)]",
    headerSubtitle: "text-[var(--ink-soft)]",
    socialButtonsBlockButton:
      "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--mist)]",
    formFieldInput:
      "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]",
    identityPreviewEditButton: "text-[var(--brand)]",
    userButtonPopoverActionButton:
      "text-[var(--ink)] hover:bg-[var(--mist)]",
    userButtonPopoverCard:
      "border border-[var(--line)] bg-[var(--surface-raised)]",
    userButtonPopoverFooter: "hidden",
  },
} satisfies ClerkAppearanceTheme;
