"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HardDrive, History, KeyRound, Lock, Plus, RefreshCw, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { EmptyState } from "@/components/ui/patterns/empty-state"
import { StatusBadge } from "@/components/ui/patterns/status-badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
      return <StatusBadge status="create" label="Created" tone="success" className="font-normal" />
    case "password_reset":
      return <StatusBadge status="password_reset" label="Password" tone="warning" className="font-normal" />
    case "quota_changed":
      return <StatusBadge status="quota_changed" label="Quota" tone="info" className="font-normal" />
    case "suspension_changed":
      return <StatusBadge status="suspension_changed" label="Suspension" tone="purple" className="font-normal" />
    default:
      return <Badge variant="outline">Action</Badge>
  }
}

const SKELETON_ITEMS = ["mailbox-sk-1", "mailbox-sk-2", "mailbox-sk-3", "mailbox-sk-4"] as const

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

  const counts = useMemo(() => {
    return {
      all: history.length,
      create: history.filter((h) => h.actionType === "create").length,
      password_reset: history.filter((h) => h.actionType === "password_reset").length,
      quota_changed: history.filter((h) => h.actionType === "quota_changed").length,
      suspension_changed: history.filter((h) => h.actionType === "suspension_changed").length,
    }
  }, [history])

  const filterTabs = [
    { key: "all", label: `All (${counts.all})` },
    { key: "create", label: `Created (${counts.create})` },
    { key: "password_reset", label: `Passwords (${counts.password_reset})` },
    { key: "quota_changed", label: `Quotas (${counts.quota_changed})` },
    { key: "suspension_changed", label: `Suspensions (${counts.suspension_changed})` },
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
        <div className="bg-muted/10 space-y-3 border-b px-4 py-3 sm:px-5">
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
          <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full">
            <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="bg-muted text-muted-foreground inline-flex h-9 w-max min-w-full items-center justify-start rounded-lg p-1 sm:min-w-0">
                {filterTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="data-[state=active]:bg-background data-[state=active]:text-foreground px-3 py-1 text-xs whitespace-nowrap data-[state=active]:shadow-sm"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        </div>
      }
    >
      <div className="py-2">
        {isLoading ? (
          <div className="space-y-3 pt-1">
            {SKELETON_ITEMS.map((itemKey) => (
              <div key={itemKey} className="bg-card space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <div className="border-border/50 flex justify-between border-t pt-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-20" />
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
          <div className="space-y-3 pt-1">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="bg-card hover:bg-muted/30 space-y-2.5 rounded-lg border p-3.5 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="bg-muted text-foreground rounded px-2 py-0.5 font-mono text-xs font-semibold break-all">
                      {item.email}
                    </span>
                    <ActionBadge actionType={item.actionType} />
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">{formatDateTime(item.createdAt, "-")}</span>
                </div>

                <div className="flex items-start gap-2.5 pt-0.5">
                  <div className="bg-muted/60 mt-0.5 shrink-0 rounded p-1">
                    <ActionIcon actionType={item.actionType} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-foreground text-sm font-medium">{item.title}</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">{item.description}</p>
                  </div>
                </div>

                <div className="border-border/50 text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-2 text-xs">
                  <span>
                    Performed by <span className="text-foreground font-medium">{item.actor.name}</span>
                    {item.actor.email && <span className="opacity-80"> ({item.actor.email})</span>}
                  </span>
                  {item.metadata.ipAddress && (
                    <span className="font-mono text-xs opacity-75">IP: {item.metadata.ipAddress}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DetailSheet>
  )
}
