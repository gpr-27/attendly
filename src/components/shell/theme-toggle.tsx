"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "@/lib/db/types";
import { refreshThemeFromSettings } from "@/components/shell/app-providers";
import { cn } from "@/lib/utils/cn";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

type ThemeToggleProps = {
  /** Compact icon strip for shell; full labeled buttons for Settings. */
  variant?: "compact" | "full";
  className?: string;
  /** Called after Dexie persist (optional UI sync). */
  onChanged?: (theme: ThemeMode) => void;
};

/**
 * Light / dark / system theme control — persists to Dexie settings.
 * Visible in shell header and Settings.
 */
export function ThemeToggle({
  variant = "compact",
  className,
  onChanged,
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { getSettings } = await import("@/lib/db");
      const settings = await getSettings();
      if (!cancelled) setTheme(settings.theme);
    })().catch(() => {
      /* keep default */
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function setMode(next: ThemeMode) {
    if (busy || next === theme) return;
    setBusy(true);
    try {
      const { saveSettings } = await import("@/lib/db");
      await saveSettings({ theme: next });
      setTheme(next);
      await refreshThemeFromSettings();
      onChanged?.(next);
    } catch {
      /* leave previous theme */
    } finally {
      setBusy(false);
    }
  }

  if (variant === "full") {
    return (
      <div
        role="group"
        aria-label="Theme"
        className={cn("flex flex-wrap gap-2", className)}
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            disabled={busy}
            onClick={() => void setMode(value)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-60",
              theme === value
                ? "bg-brand text-white"
                : "border border-line bg-mist text-brand-deep",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-line bg-mist p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            disabled={busy}
            title={label}
            aria-label={`${label} theme`}
            aria-pressed={active}
            onClick={() => void setMode(value)}
            className={cn(
              "inline-flex size-10 min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-60",
              active
                ? "bg-brand text-white shadow-sm"
                : "text-ink-soft hover:bg-surface-raised/60 hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
