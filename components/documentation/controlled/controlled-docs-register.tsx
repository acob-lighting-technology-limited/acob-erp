"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Edit,
  Eye,
  FilePen,
  FileText,
  ListChecks,
  Plus,
  ScrollText,
  Send,
  Trash2,
  Upload,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { apiFetch } from "@/lib/api-client"
import {
  CONTROLLED_DOC_META,
  CONTROLLED_DOC_STATUS_LABELS,
  describeAudience,
  formatDocDate,
  getReviewState,
  type ControlledDocListResponse,
  type ControlledDocRow,
  type ControlledDocType,
} from "@/lib/documentation/controlled"
import { AcknowledgementProgress, ControlledDocStatusBadge, ReviewDateBadge } from "./controlled-doc-badges"
import { ControlledDocAcknowledgementsDialog } from "./controlled-doc-acknowledgements-dialog"
import { ControlledDocActionDialog, type ControlledDocAction } from "./controlled-doc-action-dialog"
import { ControlledDocFormDialog } from "./controlled-doc-form-dialog"
import { ControlledDocVersionDialog } from "./controlled-doc-version-dialog"
import { ControlledDocViewDialog } from "./controlled-doc-view-dialog"

const REVIEW_LABELS = {
  overdue: "Overdue",
  due_soon: "Due in 30 days",
  ok: "Scheduled",
  none: "Not set",
} as const

function uniqueOptions(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }))
}

interface ControlledDocsRegisterProps {
  type: ControlledDocType
  backLink: { href: string; label: string }
  /** Shown in the description on department consoles. */
  departmentName?: string
}

/**
 * Management register for policies or SOPs, shared by the admin panel and the
 * department console. The API scopes rows to the request (a department console
 * only ever receives its own department) and flags which rows the caller may
 * change, so this component never decides access on its own.
 */
export function ControlledDocsRegister({ type, backLink, departmentName }: ControlledDocsRegisterProps) {
  const meta = CONTROLLED_DOC_META[type]
  const isPolicy = type === "policy"
  const queryClient = useQueryClient()
  const queryKey = ["controlled-docs", type, "manage"]

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ControlledDocRow | null>(null)
  const [versioning, setVersioning] = useState<ControlledDocRow | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [ackDoc, setAckDoc] = useState<ControlledDocRow | null>(null)
  const [pendingAction, setPendingAction] = useState<{ action: ControlledDocAction; doc: ControlledDocRow } | null>(
    null
  )

  const { data, isLoading, error, refetch } = useQuery<ControlledDocListResponse>({
    queryKey,
    queryFn: async () => {
      const res = await apiFetch(`/api/documentation/controlled?type=${type}&view=manage`, { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || `Failed to load ${meta.shortPlural.toLowerCase()}`)
      return payload
    },
  })

  const rows = useMemo(() => data?.data ?? [], [data])
  const permissions = data?.permissions ?? { canCreate: false, manageableDepartments: [] }

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["controlled-docs", type] })
    void queryClient.invalidateQueries({ queryKey: ["controlled-doc"] })
  }

  const stats = useMemo(() => {
    let published = 0
    let drafts = 0
    let reviewDue = 0
    let ackPending = 0
    for (const row of rows) {
      if (row.status === "published") published += 1
      if (row.status === "draft") drafts += 1
      const review = getReviewState(row.next_review_date)
      if (row.status !== "retired" && (review === "overdue" || review === "due_soon")) reviewDue += 1
      if (row.acknowledgement) ackPending += row.acknowledgement.total - row.acknowledgement.acknowledged
    }
    return { published, drafts, reviewDue, ackPending }
  }, [rows])

  const columns = useMemo<DataTableColumn<ControlledDocRow>[]>(() => {
    const list: DataTableColumn<ControlledDocRow>[] = [
      {
        key: "reference_code",
        label: "Ref",
        sortable: true,
        accessor: (r) => r.reference_code,
        render: (r) => <span className="font-mono text-xs">{r.reference_code}</span>,
      },
      {
        key: "title",
        label: "Title",
        sortable: true,
        resizable: true,
        initialWidth: 300,
        accessor: (r) => r.title,
        render: (r) => (
          <div className="flex flex-col">
            <span className="line-clamp-2 font-medium">{r.title}</span>
            {r.category && <span className="text-muted-foreground text-[11px]">{r.category}</span>}
          </div>
        ),
      },
      {
        key: "category",
        label: "Category",
        sortable: true,
        accessor: (r) => r.category || "",
        defaultVisible: false,
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (r) => CONTROLLED_DOC_STATUS_LABELS[r.status],
        render: (r) => <ControlledDocStatusBadge status={r.status} />,
      },
      {
        key: "version",
        label: "Version",
        sortable: true,
        accessor: (r) => r.current_version?.version_number ?? 0,
        render: (r) => (
          <div className="flex flex-col">
            <span className="text-xs font-medium">v{r.current_version?.version_number ?? "—"}</span>
            <span className="text-muted-foreground text-[11px]">
              {formatDocDate(r.current_version?.effective_date)}
            </span>
          </div>
        ),
        hideOnMobile: true,
      },
      {
        key: "next_review_date",
        label: "Next Review",
        sortable: true,
        accessor: (r) => r.next_review_date || "",
        render: (r) => <ReviewDateBadge date={r.next_review_date} />,
        hideOnMobile: true,
      },
    ]

    if (isPolicy) {
      list.push({
        key: "acknowledgement",
        label: "Acknowledged",
        sortable: true,
        accessor: (r) =>
          r.acknowledgement && r.acknowledgement.total > 0
            ? Math.round((r.acknowledgement.acknowledged / r.acknowledgement.total) * 100)
            : -1,
        render: (r) => <AcknowledgementProgress progress={r.acknowledgement} />,
        hideOnMobile: true,
      })
    } else {
      list.push(
        {
          key: "owner_department",
          label: "Owner",
          sortable: true,
          accessor: (r) => r.owner_department || "",
          render: (r) => <span className="text-xs">{r.owner_department || "—"}</span>,
          hideOnMobile: true,
        },
        {
          key: "audience",
          label: "Applies To",
          accessor: (r) => describeAudience(r),
          render: (r) => (
            <span className="line-clamp-1 text-xs" title={describeAudience(r)}>
              {describeAudience(r)}
            </span>
          ),
          hideOnMobile: true,
        }
      )
    }
    return list
  }, [isPolicy])

  const filters = useMemo<DataTableFilter<ControlledDocRow>[]>(() => {
    const list: DataTableFilter<ControlledDocRow>[] = [
      {
        key: "status",
        label: "Status",
        options: (["published", "draft", "retired"] as const).map((status) => ({
          value: CONTROLLED_DOC_STATUS_LABELS[status],
          label: CONTROLLED_DOC_STATUS_LABELS[status],
        })),
      },
      {
        key: "review",
        label: "Review",
        mode: "custom",
        options: (Object.keys(REVIEW_LABELS) as Array<keyof typeof REVIEW_LABELS>).map((state) => ({
          value: state,
          label: REVIEW_LABELS[state],
        })),
        filterFn: (row, selected) => selected.includes(getReviewState(row.next_review_date)),
      },
      { key: "category", label: "Category", options: uniqueOptions(rows.map((r) => r.category)) },
    ]
    if (!isPolicy) {
      list.push({
        key: "owner_department",
        label: "Owner",
        options: uniqueOptions(rows.map((r) => r.owner_department)),
      })
    }
    return list
  }, [rows, isPolicy])

  const Icon = isPolicy ? ScrollText : ListChecks
  const description = isPolicy
    ? departmentName
      ? `Company policies and how many ${departmentName} staff have acknowledged each one.`
      : "Publish company policies, keep them under review, and track who has acknowledged each version."
    : departmentName
      ? `SOPs owned by ${departmentName}, plus company-wide SOPs that apply to it.`
      : "Publish standard operating procedures, target them to departments, and keep them under review."

  return (
    <DataTablePage
      title={meta.plural}
      description={description}
      icon={Icon}
      backLink={backLink}
      actions={
        permissions.canCreate ? (
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add {meta.label}
          </Button>
        ) : undefined
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title={`Total ${meta.shortPlural}`}
            value={rows.length}
            icon={FileText}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Review Due"
            value={stats.reviewDue}
            icon={CalendarClock}
            iconBgColor="bg-red-500/10"
            iconColor="text-red-500"
          />
          {isPolicy ? (
            <StatCard
              variant="compact"
              title="Pending Acknowledgements"
              value={stats.ackPending}
              icon={Users}
              iconBgColor="bg-amber-500/10"
              iconColor="text-amber-500"
            />
          ) : (
            <StatCard
              variant="compact"
              title="Drafts"
              value={stats.drafts}
              icon={FilePen}
              iconBgColor="bg-amber-500/10"
              iconColor="text-amber-500"
            />
          )}
          <StatCard
            variant="compact"
            title="Published"
            value={stats.published}
            icon={CheckCircle2}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
        </StatGrid>
      }
    >
      <DataTable<ControlledDocRow>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(r) => r.id}
        searchPlaceholder={`Search ${meta.shortPlural.toLowerCase()} by title, ref, or category...`}
        searchFn={(row, query) =>
          `${row.reference_code} ${row.title} ${row.category ?? ""} ${row.owner_department ?? ""}`
            .toLowerCase()
            .includes(query)
        }
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={refetch}
        emptyIcon={Icon}
        emptyTitle={`No ${meta.shortPlural.toLowerCase()} yet`}
        emptyDescription={
          permissions.canCreate
            ? `Use Add ${meta.label} to upload the first one.`
            : `Nothing has been published here yet.`
        }
        rowActions={[
          { label: "View", icon: Eye, onClick: (r) => setViewingId(r.id) },
          {
            label: "View Acknowledgements",
            icon: Users,
            onClick: (r) => setAckDoc(r),
            hidden: (r) => !isPolicy || r.status !== "published",
          },
          { label: "Edit Details", icon: Edit, onClick: (r) => setEditing(r), hidden: (r) => !r.can_manage },
          {
            label: "Upload New Version",
            icon: Upload,
            onClick: (r) => setVersioning(r),
            hidden: (r) => !r.can_manage || r.status === "retired",
          },
          {
            label: "Publish",
            icon: Send,
            onClick: (r) => setPendingAction({ action: "publish", doc: r }),
            hidden: (r) => !r.can_manage || r.status === "published" || !r.current_version,
          },
          {
            label: "Retire",
            icon: Archive,
            onClick: (r) => setPendingAction({ action: "retire", doc: r }),
            hidden: (r) => !r.can_manage || r.status !== "published",
            variant: "destructive",
          },
          {
            label: "Delete Draft",
            icon: Trash2,
            onClick: (r) => setPendingAction({ action: "delete", doc: r }),
            hidden: (r) => !r.can_manage || r.status !== "draft" || Boolean(r.published_at),
            variant: "destructive",
          },
        ]}
        viewToggle
        contactsView
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => r.title,
          subtitle: (r) =>
            `${r.reference_code} · v${r.current_version?.version_number ?? "—"} · ${CONTROLLED_DOC_STATUS_LABELS[r.status]}`,
          trailing: (r) =>
            isPolicy && r.acknowledgement ? (
              <Badge variant="outline" className="text-[10px]">
                {r.acknowledgement.acknowledged}/{r.acknowledgement.total}
              </Badge>
            ) : (
              <ControlledDocStatusBadge status={r.status} />
            ),
          onSelect: (r) => setViewingId(r.id),
        }}
        cardRenderer={(r) => (
          <button
            type="button"
            onClick={() => setViewingId(r.id)}
            className="bg-card w-full space-y-2 rounded-xl border p-4 text-left transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-xs">{r.reference_code}</span>
              <ControlledDocStatusBadge status={r.status} />
            </div>
            <p className="line-clamp-2 text-sm font-semibold">{r.title}</p>
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>v{r.current_version?.version_number ?? "—"}</span>
              <ReviewDateBadge date={r.next_review_date} />
            </div>
            {isPolicy && r.acknowledgement && <AcknowledgementProgress progress={r.acknowledgement} />}
          </button>
        )}
        urlSync
      />

      <ControlledDocFormDialog
        type={type}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        manageableDepartments={permissions.manageableDepartments}
        onSaved={refresh}
      />
      <ControlledDocFormDialog
        type={type}
        doc={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        manageableDepartments={permissions.manageableDepartments}
        onSaved={refresh}
      />
      <ControlledDocVersionDialog
        doc={versioning}
        onOpenChange={(open) => !open && setVersioning(null)}
        onSaved={refresh}
      />
      <ControlledDocViewDialog documentId={viewingId} onOpenChange={(open) => !open && setViewingId(null)} />
      <ControlledDocAcknowledgementsDialog doc={ackDoc} onOpenChange={(open) => !open && setAckDoc(null)} />
      <ControlledDocActionDialog
        action={pendingAction?.action ?? null}
        doc={pendingAction?.doc ?? null}
        onOpenChange={(open) => !open && setPendingAction(null)}
        onDone={refresh}
      />
    </DataTablePage>
  )
}
