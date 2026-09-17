"use client"

import Link from "next/link"
import { ArrowUpRight, Clock, FileText, Inbox, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { formatWATDate, formatWATRelative } from "@/lib/utils/date"
import { MD_DESK_QUEUE_LABELS, type MdDeskQueueItem, type MdDeskQueueKind } from "@/lib/md-desk/types"
import { useMdDeskOverview } from "./use-md-desk"

const KIND_CLASSES: Record<MdDeskQueueKind, string> = {
  leave: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  requisition: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  correspondence: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  task_rating: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
}

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })

/** MD's Desk → Overview: everything currently waiting on the MD's decision. */
export function WaitingOnMd() {
  const { data, isLoading, error, refetch } = useMdDeskOverview()
  const items = data?.queue.items ?? []
  const counts = data?.queue.counts
  const now = Date.now()
  const overdue = items.filter((i) => now - new Date(i.waiting_since).getTime() > 3 * 86_400_000).length

  const columns: DataTableColumn<MdDeskQueueItem>[] = [
    {
      key: "title",
      label: "Item",
      sortable: true,
      accessor: (i) => i.title,
      render: (i) => (
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-2 truncate font-medium">
            {i.title}
            {i.urgent && <Badge variant="destructive">Emergency</Badge>}
          </p>
          {i.detail && <p className="text-muted-foreground truncate text-xs">{i.detail}</p>}
        </div>
      ),
    },
    {
      key: "kind",
      label: "Type",
      sortable: true,
      accessor: (i) => i.kind,
      render: (i) => (
        <Badge variant="outline" className={`border-transparent ${KIND_CLASSES[i.kind]}`}>
          {MD_DESK_QUEUE_LABELS[i.kind]}
        </Badge>
      ),
    },
    {
      key: "requester",
      label: "From",
      sortable: true,
      accessor: (i) => i.requester,
      render: (i) => (
        <span className="text-sm">
          {i.requester}
          {i.department && <span className="text-muted-foreground"> · {i.department}</span>}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      accessor: (i) => (typeof i.amount === "number" ? naira.format(i.amount) : "—"),
      hideOnMobile: true,
    },
    {
      key: "waiting_since",
      label: "Waiting since",
      sortable: true,
      accessor: (i) => i.waiting_since,
      render: (i) => (
        <span className="text-sm" title={formatWATDate(i.waiting_since)}>
          {formatWATRelative(i.waiting_since)}
        </span>
      ),
    },
    {
      key: "open",
      label: "",
      render: (i) => (
        <Button asChild size="sm" variant="outline">
          <Link href={i.href}>
            Open
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      ),
    },
  ]

  const filters: DataTableFilter<MdDeskQueueItem>[] = [
    {
      key: "kind",
      label: "Type",
      options: (Object.keys(MD_DESK_QUEUE_LABELS) as MdDeskQueueKind[]).map((k) => ({
        value: k,
        label: `${MD_DESK_QUEUE_LABELS[k]} (${data?.queue.counts[k] ?? 0})`,
      })),
    },
    {
      key: "urgent",
      label: "Priority",
      mode: "custom",
      options: [
        { value: "urgent", label: "Emergency" },
        { value: "normal", label: "Normal" },
      ],
      filterFn: (i, values) => values.includes(i.urgent ? "urgent" : "normal"),
    },
  ]

  return (
    <DataTablePage
      title="MD's Desk"
      description="Approvals currently at the MD's stage. Decisions are made on each item's own screen."
      icon={Inbox}
      stats={
        <StatGrid>
          <StatCard
            title="Waiting on MD"
            value={items.length}
            icon={Inbox}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            title="Waiting 3+ days"
            value={overdue}
            icon={Clock}
            iconBgColor="bg-red-500/10"
            iconColor="text-red-500"
          />
          <StatCard
            title="Requisitions"
            value={counts?.requisition ?? 0}
            icon={Wallet}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            title="Letters"
            value={counts?.correspondence ?? 0}
            icon={FileText}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
          />
        </StatGrid>
      }
    >
      <DataTable<MdDeskQueueItem>
        data={items}
        columns={columns}
        getRowId={(i) => i.id}
        searchPlaceholder="Search requests, people, departments…"
        searchFn={(i, q) =>
          [i.title, i.detail, i.requester, i.department]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        }
        filters={filters}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={() => refetch()}
        pagination={{ pageSize: 25 }}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        cardRenderer={(i) => (
          <div className="bg-card flex h-full flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={`border-transparent ${KIND_CLASSES[i.kind]}`}>
                {MD_DESK_QUEUE_LABELS[i.kind]}
              </Badge>
              {i.urgent && <Badge variant="destructive">Emergency</Badge>}
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium">{i.title}</p>
              {i.detail && <p className="text-muted-foreground line-clamp-2 text-xs">{i.detail}</p>}
            </div>
            <div className="grid gap-1 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">From</span>
                <span className="truncate">
                  {i.requester}
                  {i.department && <span className="text-muted-foreground"> · {i.department}</span>}
                </span>
              </div>
              {typeof i.amount === "number" && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Amount</span>
                  <span>{naira.format(i.amount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Waiting</span>
                <span title={formatWATDate(i.waiting_since)}>{formatWATRelative(i.waiting_since)}</span>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="mt-auto w-full">
              <Link href={i.href}>
                Open
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
        )}
        mobileRow={{
          title: (i) => i.title,
          subtitle: (i) => {
            const parts = [
              i.requester,
              i.department || null,
              typeof i.amount === "number" ? naira.format(i.amount) : null,
              formatWATRelative(i.waiting_since),
            ].filter(Boolean)
            return parts.join(" · ")
          },
          trailing: (i) => (
            <div className="flex items-center gap-1.5">
              {i.urgent && (
                <Badge variant="destructive" className="text-[10px]">
                  Emergency
                </Badge>
              )}
              <Badge variant="outline" className={`border-transparent text-[10px] ${KIND_CLASSES[i.kind]}`}>
                {MD_DESK_QUEUE_LABELS[i.kind]}
              </Badge>
            </div>
          ),
          onSelect: (i) => {
            window.location.href = i.href
          },
          detail: {
            title: (i) => i.title,
            subtitle: (i) => i.requester,
            badges: (i) => (
              <div className="flex flex-wrap items-center gap-1.5">
                {i.urgent && (
                  <Badge variant="destructive" className="text-[10px]">
                    Emergency
                  </Badge>
                )}
                <Badge variant="outline" className={`border-transparent text-[10px] ${KIND_CLASSES[i.kind]}`}>
                  {MD_DESK_QUEUE_LABELS[i.kind]}
                </Badge>
              </div>
            ),
            fields: (i) => [
              { label: "Requester", value: i.requester },
              { label: "Department", value: i.department || "—" },
              { label: "Amount", value: typeof i.amount === "number" ? naira.format(i.amount) : "—" },
              {
                label: "Waiting Since",
                value: `${formatWATDate(i.waiting_since)} (${formatWATRelative(i.waiting_since)})`,
              },
              { label: "Detail", value: i.detail || null, fullWidth: true },
            ],
            actions: (i) => [
              {
                label: "Open Approval Screen",
                icon: ArrowUpRight,
                href: i.href,
              },
            ],
          },
        }}
      />
    </DataTablePage>
  )
}
