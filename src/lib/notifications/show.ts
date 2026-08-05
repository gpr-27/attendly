/** Show a local notification via SW registration or Notification API. */

export type LocalNotificationPayload = {
  title: string;
  body: string;
  tag?: string;
  data?: { url?: string };
};

export async function showLocalNotification(
  payload: LocalNotificationPayload,
): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission !== "granted") return false;

  const options: NotificationOptions = {
    body: payload.body,
    tag: payload.tag,
    data: payload.data ?? { url: "/" },
    icon: "/favicon.ico",
    badge: "/favicon.ico",
  };

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification(payload.title, options);
      return true;
    }
  } catch {
    // Fall through to page Notification.
  }

  try {
    const n = new Notification(payload.title, options);
    n.onclick = () => {
      try {
        window.focus();
        const url =
          typeof payload.data?.url === "string" ? payload.data.url : "/";
        if (url && window.location.pathname !== url) {
          window.location.assign(url);
        }
      } catch {
        /* ignore */
      }
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
