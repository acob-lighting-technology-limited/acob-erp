"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { MdDeskAccessDto, MdDeskQueue } from "@/lib/md-desk/types"
import type { Task } from "@/types/task"

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error || fallback
}

export function useMdDeskOverview() {
  return useQuery({
    queryKey: QUERY_KEYS.mdDeskOverview(),
    queryFn: async (): Promise<{ access: MdDeskAccessDto; queue: MdDeskQueue }> => {
      const res = await apiFetch("/api/md-desk/overview", { cache: "no-store" })
      if (!res.ok) throw new Error(await readError(res, "Failed to load MD's Desk"))
      return res.json()
    },
  })
}

export function useMdTaskReviews() {
  return useQuery({
    queryKey: QUERY_KEYS.mdDeskTaskReviews(),
    queryFn: async (): Promise<{ tasks: Task[]; viewer: { id: string; canReview: boolean } }> => {
      const res = await apiFetch("/api/md-desk/task-reviews", { cache: "no-store" })
      if (!res.ok) throw new Error(await readError(res, "Failed to load task reviews"))
      return res.json()
    },
  })
}
