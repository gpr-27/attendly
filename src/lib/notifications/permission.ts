/** Browser Notification permission helpers — never throw. */

export type NotifyPermission = NotificationPermission | "unsupported";

export function notificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotifyPermission(): NotifyPermission {
  if (!notificationSupported()) return "unsupported";
  try {
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}

/**
 * Request permission (call from a user gesture, e.g. Settings toggle).
 * Returns the resulting permission; denied/unsupported is not an error.
 */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (!notificationSupported()) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return getNotifyPermission();
  }
}
