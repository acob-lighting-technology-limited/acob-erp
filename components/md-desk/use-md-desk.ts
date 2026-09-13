"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { MdDeskAccessDto, MdDeskDelegate, MdDeskQueue } from "@/lib/md-desk/types"

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

export function useMdDeskDelegates() {
  return useQuery({
    queryKey: QUERY_KEYS.mdDeskDelegates(),
    queryFn: async (): Promise<{ delegates: MdDeskDelegate[]; access: MdDeskAccessDto }> => {
      const res = await apiFetch("/api/md-desk/delegates", { cache: "no-store" })
      if (!res.ok) throw new Error(await readError(res, "Failed to load delegates"))
      return res.json()
    },
  })
}

export async function saveDelegate(profileId: string, canEdit: boolean): Promise<void> {
  const res = await apiFetch("/api/md-desk/delegates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_id: profileId, can_edit: canEdit }),
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to save delegate"))
}

export async function removeDelegate(profileId: string): Promise<void> {
  const res = await apiFetch(`/api/md-desk/delegates?profile_id=${encodeURIComponent(profileId)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to remove delegate"))
}
