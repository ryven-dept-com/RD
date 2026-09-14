/*
 * RYVEN DEPT — admin order push service worker.
 *
 * Intentionally tiny and dependency-free: FCM Web Push messages arrive as
 * standard PushEvents, so we display them directly and handle the click.
 * No storefront caching/offline logic lives here and nothing here touches
 * the public store.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = {};
  }
  const notification = msg.notification || {};
  const data = msg.data || {};
  const title =
    notification.title || data.title || "RYVEN DEPT — Nouvelle commande";
  const body = notification.body || data.body || "";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/images/icon-192.png",
      badge: "/images/icon-192.png",
      tag: data.orderId ? `ryven-order-${data.orderId}` : "ryven-order",
      renotify: false,
      data: {
        orderId: data.orderId || "",
        url: data.orderId ? `/admin/orders/${data.orderId}` : "/admin/orders",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) ||
    "/admin/orders";

  event.waitUntil(
    (async () => {
      // Focus an existing admin tab when possible…
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        try {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        } catch {
          // try the next candidate
        }
      }
      // …otherwise open the secure admin order page.
      await self.clients.openWindow(target);
    })(),
  );
});
