"use client"

import { apiFetch } from "@/lib/api-client"

export interface FeedbackEdit {
  feedbackType: string
  title: string
  description?: string | null
}

async function call(url: string, init: RequestInit): Promise<void> {
  const res = await apiFetch(url, { ...init, headers: { "Content-Type": "application/json" } })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || "Request failed")
  }
}

/** Edit feedback the signed-in user submitted. Audit logging happens server-side. */
export function updateOwnFeedback(id: string, edit: FeedbackEdit): Promise<void> {
  return call(`/api/feedback/${id}`, { method: "PATCH", body: JSON.stringify(edit) })
}

/** Delete feedback the signed-in user submitted. Audit logging happens server-side. */
export function deleteOwnFeedback(id: string): Promise<void> {
  return call(`/api/feedback/${id}`, { method: "DELETE" })
}
