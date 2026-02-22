self.addEventListener("push", (event) => {
  let payload = {
    title: "AuraZone Admin",
    body: "New update available",
    url: "/",
    icon: "/icons/icon-192.svg",
  };

  try {
    payload = { ...payload, ...(event.data ? event.data.json() : {}) };
  } catch (_) {
    // Ignore malformed payloads.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: "/icons/icon-192.svg",
      data: {
        url: payload.url || "/",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(destination);
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(destination);
        }

        return undefined;
      })
  );
});
