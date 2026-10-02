"use client"

import { apiFetch } from "@/lib/api-client"

async function send(method: "PATCH" | "DELETE", body: unknown): Promise<void> {
  const res = await apiFetch("/api/notifications", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Notification update failed")
  }
}

/** Mark specific notifications read or unread. */
export function setNotificationsRead(ids: string[], read: boolean): Promise<void> {
  return send("PATCH", { ids, read })
}

/** Mark every unread notification of the signed-in user as read. */
export function markAllNotificationsRead(): Promise<void> {
  return send("PATCH", { all: true, read: true })
}

export function deleteNotifications(ids: string[]): Promise<void> {
  return send("DELETE", { ids })
}
