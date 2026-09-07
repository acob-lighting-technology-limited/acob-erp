/**
 * Browser-side Web Push helpers.
 *
 * The iOS constraint drives the shape of this file: Safari only exposes
 * PushManager to a PWA launched from the Home Screen, never to a normal tab.
 * So "unsupported" and "needs installing first" are genuinely different states
 * and the UI has to tell them apart — otherwise iPhone users are told push is
 * unavailable when in fact they just need to install the app.
 */

export type PushSupportState =
  | "supported"
  | "requires-install" // iOS Safari, in a browser tab rather than an installed PWA
  | "unsupported" // no service worker / PushManager at all (e.g. iOS < 16.4)

export type PushPermission = "default" | "granted" | "denied"

/** True when the page is running as an installed PWA rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari-only legacy flag, still the reliable signal on iOS.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos(): boolean {
  if (typeof window === "undefined") return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export function getPushSupport(): PushSupportState {
  if (typeof window === "undefined") return "unsupported"

  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  if (hasApis) return "supported"

  // On iOS the push APIs are simply absent until the app is installed, so an
  // uninstalled iPhone is "requires-install", not "unsupported".
  if (isIos() && !isStandalone()) return "requires-install"

  return "unsupported"
}

/** VAPID keys travel as base64url but PushManager wants a Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" })
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() !== "supported") return null
  const registration = await navigator.serviceWorker.getRegistration("/")
  if (!registration) return null
  return registration.pushManager.getSubscription()
}

/**
 * Requests permission and registers this device.
 *
 * Must be called from a user gesture — browsers reject a permission prompt
 * raised on page load, and iOS is especially strict about it.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription> {
  if (getPushSupport() !== "supported") {
    throw new Error("Push notifications are not available on this device.")
  }
  if (!vapidPublicKey) {
    throw new Error("Push notifications are not configured on the server.")
  }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for Matrix. Re-enable them in your device settings to continue."
        : "Notification permission was dismissed."
    )
  }

  const registration = await registerServiceWorker()
  await navigator.serviceWorker.ready

  // Reuse an existing subscription so a repeat opt-in doesn't orphan a row.
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      // Required to be true by every browser, and enforced hardest by iOS:
      // a push that shows no notification can cost you the subscription.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }))

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  })

  if (!response.ok) {
    // Don't leave a live browser subscription the server has no record of.
    await subscription.unsubscribe().catch(() => undefined)
    throw new Error("Could not register this device for notifications.")
  }

  return subscription
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingSubscription()
  if (!subscription) return

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined)

  await subscription.unsubscribe()
}
