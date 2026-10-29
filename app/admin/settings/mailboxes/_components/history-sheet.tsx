"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HardDrive, History, KeyRound, Lock, LockOpen, Plus, RefreshCw, Search, SlidersHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { DetailTimeline, DetailTimelineEntry } from "@/components/ui/detail-dialog"
import { EmptyState } from "@/components/ui/patterns/empty-state"
import { apiFetch } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { MailboxHistoryActionType, MailboxHistoryItem } from "@/app/api/admin/mailboxes/history/route"

interface MailboxHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

async function fetchMailboxHistory(): Promise<MailboxHistoryItem[]> {
  const res = await apiFetch("/api/admin/mailboxes/history", { cache: "no-store" })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || "Failed to load mailbox history")
  return (json.data ?? []) as MailboxHistoryItem[]
}

function ActionIcon({ actionType }: { actionType: MailboxHistoryActionType }) {
  switch (actionType) {
    case "create":
      return <Plus className="h-4 w-4 text-emerald-500" />
    case "password_reset":
      return <KeyRound className="h-4 w-4 text-amber-500" />
    case "quota_changed":
      return <HardDrive className="h-4 w-4 text-blue-500" />
    case "suspension_changed":
      return <Lock className="h-4 w-4 text-purple-500" />
    default:
      return <History className="text-muted-foreground h-4 w-4" />
  }
}

function ActionBadge({ actionType }: { actionType: MailboxHistoryActionType }) {
  switch (actionType) {
    case "create":
      return <Badge className="bg-emerald-500/15 font-normal text-emerald-600 dark:text-emerald-400">Created</Badge>
    case "password_reset":
      return <Badge className="bg-amber-500/15 font-normal text-amber-600 dark:text-amber-400">Password</Badge>
    case "quota_changed":
      return <Badge className="bg-blue-500/15 font-normal text-blue-600 dark:text-blue-400">Quota</Badge>
    case "suspension_changed":
      return <Badge className="bg-purple-500/15 font-normal text-purple-600 dark:text-purple-400">Suspension</Badge>
    default:
      return <Badge variant="outline">Action</Badge>
  }
}

export function MailboxHistorySheet({ open, onOpenChange }: MailboxHistorySheetProps) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const {
    data: history = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.adminMailboxHistory(),
    queryFn: fetchMailboxHistory,
    enabled: open,
  })

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase()
    return history.filter((item) => {
      if (typeFilter !== "all" && item.actionType !== typeFilter) return false
      if (!q) return true
      return (
        item.email.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.actor.name.toLowerCase().includes(q) ||
        (item.actor.email && item.actor.email.toLowerCase().includes(q))
      )
    })
  }, [history, search, typeFilter])

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "create", label: "Created" },
    { key: "password_reset", label: "Passwords" },
    { key: "quota_changed", label: "Quotas" },
    { key: "suspension_changed", label: "Suspensions" },
  ]

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="cPanel Activity History"
      leading={<History className="text-primary h-5 w-5" />}
      description="Audit trail of mailbox creations, password resets, quotas and suspensions executed on cPanel."
      wide
      toolbar={
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by mailbox or admin…"
                className="pl-8 text-sm"
                aria-label="Filter mailbox history"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refetch()}
              disabled={isFetching}
              title="Refresh history"
              aria-label="Refresh history"
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {filterTabs.map((tab) => (
              <Button
                key={tab.key}
                size="sm"
                variant={typeFilter === tab.key ? "secondary" : "ghost"}
                onClick={() => setTypeFilter(tab.key)}
                className="h-7 text-xs"
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      }
    >
      <div className="py-2">
        {isLoading ? (
          <div className="space-y-6 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            compact
            icon={HardDrive}
            title="Failed to load history"
            description={error instanceof Error ? error.message : "An error occurred while loading audit records."}
            action={
              <Button variant="outline" size="sm" onClick={() => void refetch()} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            }
          />
        ) : filteredHistory.length === 0 ? (
          <EmptyState
            compact
            icon={History}
            title={history.length === 0 ? "No cPanel actions recorded yet" : "No matching history found"}
            description={
              history.length === 0
                ? "Changes made to mailboxes on cPanel via Matrix will appear here."
                : "Try clearing or adjusting your search filters."
            }
            action={
              search || typeFilter !== "all" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("")
                    setTypeFilter("all")
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DetailTimeline>
            {filteredHistory.map((item) => (
              <DetailTimelineEntry
                key={item.id}
                timestamp={formatDateTime(item.createdAt, "-")}
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ActionIcon actionType={item.actionType} />
                      {item.title}
                    </span>
                    <ActionBadge actionType={item.actionType} />
                  </div>
                }
              >
                <div className="space-y-1.5 pt-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-muted-foreground text-xs">Mailbox:</span>
                    <span className="bg-muted/70 text-foreground rounded px-2 py-0.5 font-mono text-xs font-semibold break-all">
                      {item.email}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">{item.description}</p>
                  <p className="text-muted-foreground pt-0.5 text-xs">
                    Performed by <span className="text-foreground font-medium">{item.actor.name}</span>
                    {item.actor.email && <span className="opacity-70"> ({item.actor.email})</span>}
                  </p>
                </div>
              </DetailTimelineEntry>
            ))}
          </DetailTimeline>
        )}
      </div>
    </DetailSheet>
  )
}
