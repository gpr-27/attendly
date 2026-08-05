"use client";

import { useEffect } from "react";
import { syncTodayNotifications } from "./sync";

/**
 * Hook from Today (or App shell): when the screen is mounted / refreshed,
 * schedule local reminders from Dexie for the rest of the day.
 */
export function useTodayNotifications(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      void syncTodayNotifications().catch(() => {
        /* never break Today for notification failures */
      });
    };

    run();

    // Re-sync when tab becomes visible again (timers may have been throttled).
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled]);
}
