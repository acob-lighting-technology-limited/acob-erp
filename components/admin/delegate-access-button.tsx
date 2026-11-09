"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { UserCheck } from "lucide-react"
import { EditAccessManager } from "@/components/admin/edit-access-manager"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"

/**
 * "Delegate access" for a lead, from their own department page. Shown only to people who hold
 * access they can hand on (the lead of an owning department, or an explicit grant holder);
 * everyone else gets nothing. Opens the same dialog as Settings > Delegation.
 */
export function DelegateAccessButton() {
  const [open, setOpen] = useState(false)
  const { data: routes = [] } = useQuery({
    queryKey: QUERY_KEYS.adminAccessDelegable(),
    queryFn: async (): Promise<string[]> => {
      const res = await apiFetch("/api/admin/access/delegable", { cache: "no-store" })
      if (!res.ok) return []
      return ((await res.json()) as { data: string[] }).data
    },
    staleTime: 5 * 60 * 1000,
  })

  if (routes.length === 0) return null

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setOpen(true)}>
        <UserCheck className="h-4 w-4" />
        <span className="hidden sm:inline">Delegate access</span>
      </Button>
      <EditAccessManager mode="delegate" routes={routes} dialogOnly open={open} onOpenChange={setOpen} />
    </>
  )
}
