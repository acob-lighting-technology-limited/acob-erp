"use client"

import Link from "next/link"
import { ArrowUpRight, FileBarChart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
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

/** Existing report screens the MD reads; MD's Desk links to them rather than copying them. */
const REPORT_LINKS = [
  { label: "Weekly reports", href: "/admin/reports/general-meeting/weekly-reports" },
  { label: "Action tracker", href: "/admin/reports/general-meeting/action-tracker" },
  { label: "Minutes of meeting", href: "/admin/reports/general-meeting/minutes-of-meeting" },
  { label: "Corporate scorecard", href: "/admin/corporate-scorecard" },
]

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })

export function WaitingOnMd() {
  const { data, isLoading, error, refetch } = useMdDeskOverview()
  const items = data?.queue.items ?? []

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
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Waiting on the MD</h2>
        <p className="text-muted-foreground text-sm">
          Approvals currently at the MD&apos;s stage. Decisions are made on each item&apos;s own screen.
        </p>
      </div>
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
      />

      <div className="bg-card rounded-xl border-2 p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium">
          <FileBarChart className="h-4 w-4" aria-hidden />
          Reports
        </p>
        <div className="flex flex-wrap gap-2">
          {REPORT_LINKS.map((r) => (
            <Button key={r.href} asChild size="sm" variant="outline">
              <Link href={r.href}>{r.label}</Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
