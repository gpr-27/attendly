/**
 * In-page timer scheduler for today’s local notifications.
 * Clears previous timers on each reschedule. Graceful when permission denied.
 */

import {
  criticalFireKey,
  markNotificationFired,
  postClassFireKey,
  preClassFireKey,
  wasNotificationFired,
} from "./fired-store";
import type { PlannedReminder } from "./plan";
import { showLocalNotification } from "./show";

const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

export function clearScheduledNotifications(): void {
  for (const id of pendingTimeouts) clearTimeout(id);
  pendingTimeouts.clear();
}

async function fireReminder(reminder: PlannedReminder): Promise<void> {
  const fireKey =
    reminder.kind === "pre"
      ? preClassFireKey(reminder.sessionId, reminder.leadMinutes)
      : reminder.kind === "post"
        ? postClassFireKey(reminder.sessionId)
        : criticalFireKey(reminder.subjectId);

  if (wasNotificationFired(fireKey)) return;
  markNotificationFired(fireKey);

  await showLocalNotification({
    title: reminder.title,
    body: reminder.body,
    tag: reminder.tag,
    data: { url: "/" },
  });
}

/**
 * Schedule planned reminders with setTimeout while the tab/PWA is alive.
 * Critical alerts with fireAtMs ≤ now fire on the next microtask.
 */
export function scheduleReminders(
  reminders: PlannedReminder[],
  nowMs = Date.now(),
): number {
  clearScheduledNotifications();
  let scheduled = 0;

  for (const reminder of reminders) {
    const delay = Math.max(0, reminder.fireAtMs - nowMs);
    // Cap extremely long timers (Safari quirks) — plan already filters 24h.
    if (delay > 24 * 60 * 60 * 1000) continue;

    const fireKey =
      reminder.kind === "pre"
        ? preClassFireKey(reminder.sessionId, reminder.leadMinutes)
        : reminder.kind === "post"
          ? postClassFireKey(reminder.sessionId)
          : criticalFireKey(reminder.subjectId);

    if (wasNotificationFired(fireKey)) continue;

    const id = setTimeout(() => {
      pendingTimeouts.delete(id);
      void fireReminder(reminder);
    }, delay);
    pendingTimeouts.add(id);
    scheduled += 1;
  }

  return scheduled;
}
