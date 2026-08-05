/** Register the lightweight Attendly SW used for local notifications. */

const SW_PATH = "/sw.js";

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
    return reg;
  } catch {
    return null;
  }
}
