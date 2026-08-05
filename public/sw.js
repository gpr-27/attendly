/* Attendly — minimal service worker for local notifications (no push). */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data;
  const url =
    raw && typeof raw === "object" && typeof raw.url === "string"
      ? raw.url
      : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus().then((focused) => {
              if (focused && "navigate" in focused && url) {
                try {
                  return focused.navigate(url);
                } catch {
                  return focused;
                }
              }
              return focused;
            });
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
        return undefined;
      },
    ),
  );
});
