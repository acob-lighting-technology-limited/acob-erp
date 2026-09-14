"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CircleAlert, Eye, FileText, ListChecks, RefreshCw, ScrollText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { apiFetch } from "@/lib/api-client"
import {
  CONTROLLED_DOC_META,
  describeAudience,
  formatDocDate,
  type ControlledDocListResponse,
  type ControlledDocRow,
  type ControlledDocType,
} from "@/lib/documentation/controlled"
import { MyAcknowledgementBadge } from "./controlled-doc-badges"
import { ControlledDocViewDialog } from "./controlled-doc-view-dialog"

const RECENT_DAYS = 30

function uniqueOptions(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }))
}

function isRecent(doc: ControlledDocRow): boolean {
  const stamp = doc.current_version?.created_at || doc.published_at
  if (!stamp) return false
  return Date.now() - new Date(stamp).getTime() <= RECENT_DAYS * 86_400_000
}

/** Read-only staff view of the policies or SOPs addressed to them. */
export function ControlledDocsLibrary({ type }: { type: ControlledDocType }) {
  const meta = CONTROLLED_DOC_META[type]
  const isPolicy = type === "policy"
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const queryKey = ["controlled-docs", type, "library"]
  // A notification links here with ?doc=<id>; open that document straight away.
  const [viewingId, setViewingId] = useState<string | null>(() => searchParams.get("doc"))

  const { data, isLoading, error, refetch } = useQuery<ControlledDocListResponse>({
    queryKey,
    queryFn: async () => {
      const res = await apiFetch(`/api/documentation/controlled?type=${type}&view=library`, { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || `Failed to load ${meta.shortPlural.toLowerCase()}`)
      return payload
    },
  })

  const rows = useMemo(() => data?.data ?? [], [data])
  const pendingCount = rows.filter((row) => !row.my_acknowledged_at).length
  const recentCount = rows.filter(isRecent).length

  const columns = useMemo<DataTableColumn<ControlledDocRow>[]>(() => {
    const base: DataTableColumn<ControlledDocRow>[] = [
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
        initialWidth: 320,
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
        key: "version",
        label: "Version",
        sortable: true,
        accessor: (r) => r.current_version?.version_number ?? 0,
        render: (r) => (
          <Badge variant="outline" className="text-xs">
            v{r.current_version?.version_number ?? "—"}
          </Badge>
        ),
      },
      {
        key: "effective_date",
        label: "Effective",
        sortable: true,
        accessor: (r) => r.current_version?.effective_date || "",
        render: (r) => <span className="text-xs">{formatDocDate(r.current_version?.effective_date)}</span>,
        hideOnMobile: true,
      },
    ]

    if (isPolicy) {
      base.push({
        key: "my_status",
        label: "My Status",
        sortable: true,
        accessor: (r) => (r.my_acknowledged_at ? "Acknowledged" : "Action needed"),
        render: (r) => <MyAcknowledgementBadge doc={r} />,
      })
    } else {
      base.push(
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
    return base
  }, [isPolicy])

  const filters = useMemo<DataTableFilter<ControlledDocRow>[]>(() => {
    const list: DataTableFilter<ControlledDocRow>[] = [
      { key: "category", label: "Category", options: uniqueOptions(rows.map((r) => r.category)) },
      {
        key: "updated",
        label: "Updated",
        mode: "custom",
        options: [{ value: "recent", label: `Last ${RECENT_DAYS} days` }],
        filterFn: (row, selected) => !selected.includes("recent") || isRecent(row),
      },
    ]
    if (isPolicy) {
      list.push({
        key: "my_status",
        label: "My Status",
        options: [
          { value: "Action needed", label: "Action needed" },
          { value: "Acknowledged", label: "Acknowledged" },
        ],
      })
    } else {
      list.push(
        { key: "owner_department", label: "Owner", options: uniqueOptions(rows.map((r) => r.owner_department)) },
        {
          key: "audience",
          label: "Applies To",
          mode: "custom",
          options: [
            { value: "company", label: "Company-wide" },
            { value: "department", label: "My department" },
          ],
          filterFn: (row, selected) =>
            selected.some((value) => (value === "company" ? row.is_company_wide : !row.is_company_wide)),
        }
      )
    }
    return list
  }, [rows, isPolicy])

  const Icon = isPolicy ? ScrollText : ListChecks

  return (
    <DataTablePage
      title={meta.plural}
      description={
        isPolicy
          ? "The company policies currently in force. Open each one and acknowledge it once you've read it."
          : "Step-by-step procedures for your work — company-wide ones plus your department's own."
      }
      icon={Icon}
      backLink={{ href: "/documentation", label: "Back to Documentation" }}
      statBadgeStyle="line"
      statBadges={[
        { label: `${rows.length} ${meta.shortPlural.toLowerCase()}`, icon: FileText },
        ...(isPolicy
          ? [
              {
                label: `${pendingCount} to acknowledge`,
                icon: CircleAlert,
                tone: pendingCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined,
              },
            ]
          : []),
        { label: `${recentCount} updated in ${RECENT_DAYS} days`, icon: RefreshCw },
      ]}
    >
      <DataTable<ControlledDocRow>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(r) => r.id}
        searchPlaceholder={`Search ${meta.shortPlural.toLowerCase()} by title, ref, or category...`}
        searchFn={(row, query) =>
          `${row.reference_code} ${row.title} ${row.category ?? ""} ${row.description ?? ""}`
            .toLowerCase()
            .includes(query)
        }
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={refetch}
        emptyIcon={Icon}
        emptyTitle={`No ${meta.shortPlural.toLowerCase()} yet`}
        emptyDescription={
          isPolicy
            ? "Published company policies will appear here."
            : "SOPs for the whole company and for your department will appear here."
        }
        rowActions={[{ label: "View", icon: Eye, onClick: (r) => setViewingId(r.id) }]}
        viewToggle
        contactsView
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => r.title,
          subtitle: (r) =>
            `${r.reference_code} · v${r.current_version?.version_number ?? "—"}${r.category ? ` · ${r.category}` : ""}`,
          trailing: (r) => (isPolicy ? <MyAcknowledgementBadge doc={r} /> : null),
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
              {isPolicy ? (
                <MyAcknowledgementBadge doc={r} />
              ) : (
                <Badge variant="outline">v{r.current_version?.version_number ?? "—"}</Badge>
              )}
            </div>
            <p className="line-clamp-2 text-sm font-semibold">{r.title}</p>
            <p className="text-muted-foreground text-xs">
              Effective {formatDocDate(r.current_version?.effective_date)} · {describeAudience(r)}
            </p>
          </button>
        )}
        urlSync
      />

      <ControlledDocViewDialog
        documentId={viewingId}
        onOpenChange={(open) => !open && setViewingId(null)}
        onChanged={() => void queryClient.invalidateQueries({ queryKey })}
      />
    </DataTablePage>
  )
}
