/* eslint-disable no-undef */
/**
 * Matrix service worker.
 *
 * Deliberately minimal: it exists to receive push events, not to cache the
 * app. Matrix is an ERP whose data must never be served stale, so there is no
 * fetch handler and no offline cache here.
 */

// Take over as soon as a new version is published, rather than waiting for
// every tab to close. Push handlers should not lag a deploy.
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  // iOS requires every push to show a visible notification. If the payload is
  // missing or unparseable we still have to display something, or Safari may
  // revoke the push subscription entirely.
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.title || "Matrix"
  const options = {
    body: payload.body || "You have a new notification.",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    tag: payload.tag || undefined,
    // Collapse repeats of the same entity, but still alert for a genuine update.
    renotify: Boolean(payload.tag),
    requireInteraction: payload.priority === "urgent",
    timestamp: payload.timestamp || Date.now(),
    data: {
      url: payload.url || "/",
      notificationId: payload.notificationId || null,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = (event.notification.data && event.notification.data.url) || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Prefer focusing an open Matrix tab and navigating it, so tapping a
      // notification never strands the user in a second copy of the app.
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.focus()
          if ("navigate" in client) {
            return client.navigate(targetUrl)
          }
          return undefined
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
      return undefined
    })
  )
})

// Fired when the push service rotates a subscription. Re-subscribing here keeps
// the device registered without the user re-granting permission.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: event.oldSubscription?.options?.applicationServerKey })
      .then((subscription) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        })
      )
      .catch(() => undefined)
  )
})
