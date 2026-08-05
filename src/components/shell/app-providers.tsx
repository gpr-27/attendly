"use client";

import { useEffect } from "react";
import { AiFocusProvider } from "@/components/ai/ai-focus-context";
import { UserDatabaseProvider } from "@/components/shell/user-database-provider";
import type { ThemeMode } from "@/lib/db/types";

const THEME_EVENT = "attendly-theme-changed";

function applyThemeMode(theme: ThemeMode) {
  const root = document.documentElement;
  let resolved: "light" | "dark";
  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } else {
    resolved = theme;
  }
  root.dataset.theme = resolved;
  root.classList.toggle("dark", resolved === "dark");
}

function applyA11yPrefs(prefs: {
  highContrast: boolean;
  reducedMotion: boolean;
  largeTapTargets: boolean;
}) {
  const root = document.documentElement;
  root.dataset.highContrast = prefs.highContrast ? "true" : "false";
  root.dataset.reducedMotion = prefs.reducedMotion ? "true" : "false";
  root.dataset.largeTaps = prefs.largeTapTargets ? "true" : "false";
}

async function syncFromSettings() {
  const { getBoundUserId, getSettings } = await import("@/lib/db");
  if (!getBoundUserId()) return null;
  const settings = await getSettings();
  applyThemeMode(settings.theme);
  applyA11yPrefs({
    highContrast: settings.highContrast,
    reducedMotion: settings.reducedMotion,
    largeTapTargets: settings.largeTapTargets,
  });
  return settings;
}

function ThemeSync({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    function onSystemTheme() {
      void (async () => {
        if (cancelled) return;
        const { getSettings } = await import("@/lib/db");
        const settings = await getSettings();
        if (cancelled || settings.theme !== "system") return;
        applyThemeMode("system");
      })();
    }

    function onThemeChanged() {
      void syncFromSettings().catch(() => {
        /* keep defaults */
      });
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onSystemTheme);
    window.addEventListener(THEME_EVENT, onThemeChanged);

    void syncFromSettings().catch(() => {
      /* keep daylight defaults */
    });

    return () => {
      cancelled = true;
      media.removeEventListener("change", onSystemTheme);
      window.removeEventListener(THEME_EVENT, onThemeChanged);
    };
  }, []);

  return <>{children}</>;
}

/** Per-user Dexie + theme / a11y prefs onto <html>. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UserDatabaseProvider>
      <ThemeSync>
        <AiFocusProvider>{children}</AiFocusProvider>
      </ThemeSync>
    </UserDatabaseProvider>
  );
}

/** Call after saving a11y/theme in Settings so UI updates without reload. */
export async function refreshThemeFromSettings(): Promise<void> {
  await syncFromSettings();
  window.dispatchEvent(new Event(THEME_EVENT));
}
