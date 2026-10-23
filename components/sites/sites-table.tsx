"use client"

import { useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { MapPin, Pencil, Trash2 } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { useSites } from "@/hooks/use-sites"
import {
  CONVEYANCE_STANDING_LABELS,
  conveyanceStanding,
  documentStanding,
  type ConveyanceStanding,
} from "@/lib/sites/conveyance"
import type { SiteRecord } from "@/lib/sites/records"
import { NIGERIA_STATES } from "@/lib/sites/nigeria-states"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { ConveyanceStandingBadge, DocumentBadges } from "./conveyance-badges"
import { DeleteSiteDialog } from "./delete-site-dialog"
import { SiteDialog } from "./site-dialog"

type SiteRow = SiteRecord & { standing: ConveyanceStanding }

const STANDING_ORDER: ConveyanceStanding[] = ["expired", "expiring", "pending", "valid", "none"]

export type SiteDialogState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; site: SiteRecord }

/**
 * The Sites register table. Shared by the Sites page and a portfolio's Sites
 * tab — `portfolioId` narrows it to that portfolio and drops the portfolio
 * filter. The dialog state lives with the caller so its header "Add Site"
 * button and the table's row actions open the same dialog.
 */
export function SitesTable({
  portfolioId = null,
  dialog,
  setDialog,
  deleting,
  setDeleting,
}: {
  portfolioId?: string | null
  dialog: SiteDialogState
  setDialog: (state: SiteDialogState) => void
  deleting: SiteRecord | null
  setDeleting: (site: SiteRecord | null) => void
}) {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useSites(portfolioId)
  const canEdit = data?.canEdit ?? false
  const today = toLocalISODate()

  const rows = useMemo<SiteRow[]>(
    () => (data?.data ?? []).map((site) => ({ ...site, standing: conveyanceStanding(site.documents, today) })),
    [data, today]
  )

  // Every sites list (whole register and per-portfolio) shares the "sites" prefix.
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sites"] })

  const columns = useMemo<DataTableColumn<SiteRow>[]>(
    () => [
      {
        key: "name",
        label: "Site",
        sortable: true,
        accessor: (r) => r.name,
        render: (r) => (
          <div className="space-y-0.5">
            <p className="text-foreground font-semibold">{r.name}</p>
            {r.project && <p className="text-muted-foreground line-clamp-1 text-xs">{r.project.project_name}</p>}
          </div>
        ),
      },
      { key: "lga", label: "LGA", sortable: true, accessor: (r) => r.lga ?? "", hideOnMobile: true },
      { key: "state", label: "State", sortable: true, accessor: (r) => r.state ?? "" },
      {
        key: "date_signed",
        label: "Date signed",
        sortable: true,
        accessor: (r) => r.date_signed ?? "",
        render: (r) =>
          r.date_signed ? (
            <span className="text-xs whitespace-nowrap">{formatWATDate(r.date_signed)}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
        hideOnMobile: true,
      },
      {
        key: "conveyance",
        label: "Conveyance status",
        description:
          "Each document's standing today. Expiring soon means it lapses within 60 days; the site's status is its worst document.",
        sortable: true,
        accessor: (r) => STANDING_ORDER.indexOf(r.standing),
        render: (r) => <DocumentBadges documents={r.documents} today={today} />,
      },
      ...(portfolioId
        ? []
        : [
            {
              key: "portfolio",
              label: "Portfolio",
              sortable: true,
              accessor: (r: SiteRow) => (r.portfolio ? r.portfolio.code || r.portfolio.name : ""),
              hideOnMobile: true,
              defaultVisible: false,
            },
          ]),
      {
        key: "notes",
        label: "Notes / comments",
        accessor: (r) => r.notes ?? "",
        render: (r) =>
          r.notes ? (
            <p className="text-muted-foreground line-clamp-2 max-w-xs text-xs">{r.notes}</p>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
        hideOnMobile: true,
      },
    ],
    [portfolioId, today]
  )

  const filters = useMemo<DataTableFilter<SiteRow>[]>(() => {
    const states = Array.from(new Set(rows.map((r) => r.state).filter((s): s is string => Boolean(s))))
    const knownOrder = NIGERIA_STATES as readonly string[]
    states.sort((a, b) => knownOrder.indexOf(a) - knownOrder.indexOf(b) || a.localeCompare(b))
    const portfolios = new Map<string, string>()
    for (const r of rows) if (r.portfolio) portfolios.set(r.portfolio.id, r.portfolio.code || r.portfolio.name)

    return [
      {
        key: "conveyance",
        label: "Conveyance",
        options: STANDING_ORDER.map((value) => ({ value, label: CONVEYANCE_STANDING_LABELS[value] })),
        mode: "custom",
        // A site is "Expiring" if any one document is, not only when that is its worst.
        filterFn: (row, selected) =>
          selected.some((value) =>
            value === "none" || value === "valid"
              ? row.standing === value
              : row.documents.some((doc) => documentStanding(doc, today) === value)
          ),
      },
      {
        key: "state",
        label: "State",
        options: states.map((value) => ({ value, label: value })),
      },
      ...(portfolioId
        ? []
        : [
            {
              key: "portfolio",
              label: "Portfolio",
              options: [
                ...Array.from(portfolios, ([value, label]) => ({ value, label })),
                { value: "__none__", label: "No portfolio" },
              ],
              mode: "custom" as const,
              filterFn: (row: SiteRow, selected: string[]) => selected.includes(row.portfolio?.id ?? "__none__"),
            },
          ]),
    ]
  }, [rows, portfolioId, today])

  const closeDialog = () => setDialog({ mode: "closed" })

  return (
    <>
      <DataTable<SiteRow>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(r) => r.id}
        searchPlaceholder="Search site, LGA, state or notes..."
        searchFn={(row, query) => {
          const q = query.toLowerCase()
          return [row.name, row.lga, row.state, row.notes, row.project?.project_name].some((value) =>
            (value || "").toLowerCase().includes(q)
          )
        }}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={refetch}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => r.name,
          subtitle: (r) => [r.lga, r.state].filter(Boolean).join(", ") || "Location not recorded",
          trailing: (r) => <ConveyanceStandingBadge standing={r.standing} />,
          onSelect: canEdit ? (r) => setDialog({ mode: "edit", site: r }) : undefined,
        }}
        cardRenderer={(r) => (
          <div className="bg-card space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-muted-foreground text-xs">
                  {[r.lga, r.state].filter(Boolean).join(", ") || "Location not recorded"}
                </p>
              </div>
              <ConveyanceStandingBadge standing={r.standing} />
            </div>
            <DocumentBadges documents={r.documents} today={today} />
          </div>
        )}
        rowActions={
          canEdit
            ? [
                { label: "Edit Site", icon: Pencil, onClick: (r: SiteRow) => setDialog({ mode: "edit", site: r }) },
                {
                  label: "Delete Site",
                  icon: Trash2,
                  variant: "destructive" as const,
                  onClick: (r: SiteRow) => setDeleting(r),
                },
              ]
            : undefined
        }
        emptyTitle="No Sites Yet"
        emptyDescription={
          canEdit
            ? "Add the sites you have signed or profiled, with their conveyance documents."
            : "No sites have been added to the register yet."
        }
        emptyIcon={MapPin}
        urlSync={!portfolioId}
      />

      {canEdit && (
        <>
          <SiteDialog
            open={dialog.mode !== "closed"}
            onOpenChange={(open) => !open && closeDialog()}
            site={dialog.mode === "edit" ? dialog.site : null}
            defaultPortfolioId={portfolioId}
            onDelete={(site) => {
              closeDialog()
              setDeleting(site)
            }}
            onSuccess={() => {
              toast.success(dialog.mode === "edit" ? "Site updated" : "Site added")
              closeDialog()
              void refresh()
            }}
          />
          <DeleteSiteDialog
            site={deleting}
            onOpenChange={(open) => !open && setDeleting(null)}
            onDeleted={() => {
              setDeleting(null)
              void refresh()
            }}
          />
        </>
      )}
    </>
  )
}
