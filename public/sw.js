// Service Worker for Passport Pub PWA
const CACHE_NAME = "passport-pub-v3";
const APP_SHELL = [
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.svg",
];

// Install: precache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Push notification handler
self.addEventListener("push", (event) => {
  let data = { title: "Passport Pub", body: "You have a new notification" };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    // Use default data
  }

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/admin/dashboard",
    },
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "Passport Pub", options),
      // Update app icon badge with pending bookings count
      fetch("/api/bookings/pending-count")
        .then((res) => res.json())
        .then(({ count }) => {
          if (navigator.setAppBadge && count > 0) {
            return navigator.setAppBadge(count);
          } else if (navigator.clearAppBadge) {
            return navigator.clearAppBadge();
          }
        })
        .catch(() => {}),
    ])
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/admin/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Fetch handler: network-first with cache fallback (static assets only)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, API, and auth routes
  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/auth/")) return;

  // Never cache navigation requests (HTML pages) — let Next.js handle client-side routing
  if (request.mode === "navigate") return;

  // Only cache static assets (images, fonts, CSS, JS chunks from /_next/static/)
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf|css)$/);

  if (!isStaticAsset) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
