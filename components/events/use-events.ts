"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { EventOptions, EventsResponse } from "@/lib/events/types"

export type EventRange = { from: Date; to: Date }

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error || fallback
}

export function useEvents(range: EventRange, scope: "all" | "md" = "all") {
  const from = range.from.toISOString()
  const to = range.to.toISOString()
  return useQuery({
    queryKey: QUERY_KEYS.events({ from, to, scope }),
    queryFn: async (): Promise<EventsResponse> => {
      const params = new URLSearchParams({ from, to })
      if (scope === "md") params.set("scope", "md")
      const res = await apiFetch(`/api/events?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error(await readError(res, "Failed to load events"))
      return res.json()
    },
  })
}

export function useEventOptions() {
  return useQuery({
    queryKey: QUERY_KEYS.eventOptions(),
    queryFn: async (): Promise<EventOptions> => {
      const res = await apiFetch("/api/events/options", { cache: "no-store" })
      if (!res.ok) throw new Error(await readError(res, "Failed to load event options"))
      return res.json()
    },
    staleTime: 5 * 60_000,
  })
}

export async function saveEvent(
  payload: unknown,
  id?: string
): Promise<{
  id: string
  warning: string | null
  message?: string | null
  count?: number
  skipped_holidays?: string[]
}> {
  const res = await apiFetch(id ? `/api/events/${id}` : "/api/events", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to save event"))
  return res.json()
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await apiFetch(`/api/events/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error(await readError(res, "Failed to delete event"))
}

export async function respondToEvent(id: string, rsvp: string): Promise<void> {
  const res = await apiFetch(`/api/events/${id}/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rsvp }),
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to save your response"))
}

/** First instant of the WAT month containing `date`, as a Date. */
export function startOfWatMonth(year: number, monthIndex: number): Date {
  const mm = String(monthIndex + 1).padStart(2, "0")
  return new Date(`${year}-${mm}-01T00:00:00+01:00`)
}

/** Range covering a full 6-week month grid around the given WAT month. */
export function monthGridRange(year: number, monthIndex: number): EventRange {
  const first = startOfWatMonth(year, monthIndex)
  // Monday-first grid: step back to the Monday on or before the 1st (in WAT).
  const weekday = (new Date(first.getTime() + 3_600_000).getUTCDay() + 6) % 7
  const from = new Date(first.getTime() - weekday * 86_400_000)
  const to = new Date(from.getTime() + 42 * 86_400_000)
  return { from, to }
}
