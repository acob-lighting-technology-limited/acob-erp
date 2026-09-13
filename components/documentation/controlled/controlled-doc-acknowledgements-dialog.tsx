"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, CircleAlert, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch } from "@/lib/api-client"
import { formatDocDate, type AcknowledgementStaffRow, type ControlledDocRow } from "@/lib/documentation/controlled"

type Filter = "pending" | "acknowledged" | "all"

interface ControlledDocAcknowledgementsDialogProps {
  doc: ControlledDocRow | null
  onOpenChange: (open: boolean) => void
}

export function ControlledDocAcknowledgementsDialog({ doc, onOpenChange }: ControlledDocAcknowledgementsDialogProps) {
  const open = doc !== null
  const [filter, setFilter] = useState<Filter>("pending")
  const [search, setSearch] = useState("")

  const { data, isLoading, error } = useQuery<{ data: AcknowledgementStaffRow[] }>({
    queryKey: ["controlled-doc-acknowledgements", doc?.id, doc?.current_version?.id],
    queryFn: async () => {
      const res = await apiFetch(`/api/documentation/controlled/${doc?.id}/acknowledgements`, { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load acknowledgements")
      return payload
    },
    enabled: open,
  })

  const rows = useMemo(() => data?.data ?? [], [data])
  const acknowledgedCount = rows.filter((row) => row.acknowledged_at).length

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter === "pending" && row.acknowledged_at) return false
      if (filter === "acknowledged" && !row.acknowledged_at) return false
      if (!query) return true
      return `${row.name} ${row.department ?? ""}`.toLowerCase().includes(query)
    })
  }, [rows, filter, search])

  function close() {
    setFilter("pending")
    setSearch("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[90vh] sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Acknowledgements</DialogTitle>
          <DialogDescription>
            {doc?.reference_code} · {doc?.title} · version {doc?.current_version?.version_number}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-destructive text-sm">{error instanceof Error ? error.message : "Failed to load"}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">{acknowledgedCount}</span> of{" "}
              <span className="font-semibold">{rows.length}</span> active staff have acknowledged this version.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
                <TabsList>
                  <TabsTrigger value="pending">Pending ({rows.length - acknowledgedCount})</TabsTrigger>
                  <TabsTrigger value="acknowledged">Done ({acknowledgedCount})</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search staff..."
                  className="pl-8"
                />
              </div>
            </div>

            <ul className="max-h-[45vh] divide-y overflow-y-auto rounded-lg border">
              {visible.length === 0 ? (
                <li className="text-muted-foreground px-3 py-6 text-center text-sm">
                  {filter === "pending" && !search ? "Everyone has acknowledged this version." : "No staff match."}
                </li>
              ) : (
                visible.map((row) => (
                  <li key={row.user_id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.name}</p>
                      <p className="text-muted-foreground truncate text-xs">{row.department || "No department"}</p>
                    </div>
                    {row.acknowledged_at ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {formatDocDate(row.acknowledged_at)}
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <CircleAlert className="h-3.5 w-3.5" />
                        Pending
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
