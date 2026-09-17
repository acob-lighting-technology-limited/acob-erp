"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CalendarX, CheckCircle2, Download, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { apiFetch } from "@/lib/api-client"
import { toLocalISODate } from "@/lib/utils/date"
import { exportRiskRegisterToExcel } from "@/lib/risk-register/export"
import {
  RATING_BANDS,
  RATING_LABELS,
  STATUS_LABELS,
  impactLabel,
  isRiskOverdue,
  likelihoodLabel,
  riskReference,
  type RiskRating,
  type RiskRow,
  type RiskStatus,
} from "@/lib/risk-register/model"
import { RatingBadge, StatusBadge } from "./risk-badges"
import { RiskCard } from "./risk-card"
import { RiskFormDialog, type StaffOption } from "./risk-form-dialog"
import { RiskHeatMap } from "./risk-heat-map"
import { TimelineText, describeTimeline } from "./risk-timeline"

interface RiskRegisterViewProps {
  departments: Array<{ name: string; code: string | null }>
  staff: StaffOption[]
  raisableDepartments: string[]
  currentUserId: string
  isAdminLike: boolean
}

const QUERY_KEY = ["corporate-services-risk-register"]

const TABS: DataTableTab[] = [
  { key: "register", label: "Register" },
  { key: "heat-map", label: "Heat Map" },
]

function DetailBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs font-semibold uppercase">{label}</span>
      <p className="text-foreground mt-1 text-sm whitespace-pre-line">
        {value || <span className="text-muted-foreground italic">Not recorded</span>}
      </p>
    </div>
  )
}

export function RiskRegisterView({
  departments,
  staff,
  raisableDepartments,
  currentUserId,
  isAdminLike,
}: RiskRegisterViewProps) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState("register")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RiskRow | null>(null)
  const [deleting, setDeleting] = useState<RiskRow | null>(null)
  const today = toLocalISODate()

  const { data, isLoading, error, refetch } = useQuery<{ data: RiskRow[] }>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/corporate-services/risk-register", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load the risk register")
      return res.json()
    },
  })
  const risks = useMemo(() => data?.data || [], [data])

  const departmentCodes = useMemo(() => Object.fromEntries(departments.map((d) => [d.name, d.code])), [departments])
  const staffNames = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s.name])), [staff])
  const departmentNames = useMemo(() => departments.map((d) => d.name), [departments])
  const raisable = new Set(raisableDepartments)

  const reference = (r: RiskRow) => riskReference(departmentCodes[r.department], r.department, r.serial_no)
  const canEditAll = (r: RiskRow) => isAdminLike || raisable.has(r.department)
  const canEdit = (r: RiskRow) => canEditAll(r) || r.control_owner_id === currentUserId
  const ownerName = (r: RiskRow) => (r.control_owner_id ? staffNames[r.control_owner_id] || "Unknown" : null)

  const openRisks = risks.filter((r) => r.status !== "closed")
  const redCount = openRisks.filter((r) => r.rating === "red").length
  const overdueCount = risks.filter((r) => isRiskOverdue(r, today)).length
  const closedCount = risks.length - openRisks.length

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(risk: RiskRow) {
    setEditing(risk)
    setFormOpen(true)
  }

  function handleSaved(saved: RiskRow) {
    queryClient.setQueryData<{ data: RiskRow[] }>(QUERY_KEY, (old) => {
      const rows = old?.data || []
      const exists = rows.some((r) => r.id === saved.id)
      return { data: exists ? rows.map((r) => (r.id === saved.id ? saved : r)) : [...rows, saved] }
    })
  }

  async function confirmDelete() {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    try {
      const res = await apiFetch(`/api/corporate-services/risk-register/${target.id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Failed to delete the risk")
      }
      queryClient.setQueryData<{ data: RiskRow[] }>(QUERY_KEY, (old) => ({
        data: (old?.data || []).filter((r) => r.id !== target.id),
      }))
      toast.success("Risk deleted")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete the risk")
    }
  }

  const columns: DataTableColumn<RiskRow>[] = [
    {
      key: "reference",
      label: "S/N",
      description: "Department code and the risk's number within that department.",
      sortable: true,
      accessor: (r) => reference(r),
      render: (r) => <span className="font-mono text-xs whitespace-nowrap">{reference(r)}</span>,
    },
    {
      key: "department",
      label: "Department or Unit",
      sortable: true,
      accessor: (r) => r.department,
      render: (r) => (
        <div className="space-y-0.5">
          <span className="text-sm whitespace-nowrap">{r.department}</span>
          {r.supporting_departments.length > 0 && (
            <p className="text-muted-foreground text-[11px]">with {r.supporting_departments.join(", ")}</p>
          )}
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "risk_name",
      label: "Risk Name",
      sortable: true,
      accessor: (r) => r.risk_name,
      render: (r) => (
        <div className="max-w-sm space-y-0.5 py-1">
          <p className="text-foreground line-clamp-2 text-sm font-medium">{r.risk_name}</p>
          <p className="text-muted-foreground line-clamp-2 text-xs">{r.description}</p>
        </div>
      ),
      resizable: true,
      initialWidth: 320,
    },
    {
      key: "rating",
      label: "Inherent Rating",
      description: "Impact × likelihood. Green 1–4, Yellow 5–12, Red 15–25.",
      sortable: true,
      accessor: (r) => r.score,
      render: (r) => (
        <div className="space-y-0.5">
          <RatingBadge rating={r.rating} score={r.score} className="text-xs" />
          <p className="text-muted-foreground text-[11px] whitespace-nowrap">
            I{r.impact} × L{r.likelihood}
          </p>
        </div>
      ),
    },
    {
      key: "control_owner",
      label: "Control Owner",
      accessor: (r) => [r.control_owner_departments.join(", "), ownerName(r)].filter(Boolean).join(" — "),
      render: (r) => (
        <div className="space-y-0.5">
          <span className="text-xs">{r.control_owner_departments.join(", ")}</span>
          {ownerName(r) && <p className="text-muted-foreground text-[11px]">{ownerName(r)}</p>}
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "timeline",
      label: "Timeline",
      sortable: true,
      accessor: (r) => (r.timeline_type === "continuous" ? "9999-12-31" : r.target_date || ""),
      render: (r) => <TimelineText risk={r} today={today} />,
      hideOnMobile: true,
    },
    {
      key: "status",
      label: "Risk Status",
      sortable: true,
      accessor: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} className="text-xs" />,
    },
  ]

  const filters: DataTableFilter<RiskRow>[] = [
    {
      key: "department",
      label: "Department",
      options: departmentNames.map((d) => ({ value: d, label: d })),
      mode: "custom",
      filterFn: (r, values) =>
        [r.department, ...r.supporting_departments, ...r.control_owner_departments].some((d) => values.includes(d)),
    },
    {
      key: "rating",
      label: "Rating",
      options: (Object.keys(RATING_LABELS) as RiskRating[]).map((k) => ({
        value: k,
        label: `${RATING_LABELS[k]} (${RATING_BANDS[k]})`,
      })),
      mode: "custom",
      filterFn: (r, values) => values.includes(r.rating),
    },
    {
      key: "status",
      label: "Status",
      options: (Object.keys(STATUS_LABELS) as RiskStatus[]).map((k) => ({ value: k, label: STATUS_LABELS[k] })),
    },
  ]

  const detailFields = (r: RiskRow) => [
    { label: "Department or Unit", value: [r.department, ...r.supporting_departments].join(" / ") },
    { label: "Inherent Impact", value: `${r.impact} - ${impactLabel(r.impact)}` },
    { label: "Inherent Likelihood", value: `${r.likelihood} - ${likelihoodLabel(r.likelihood)}` },
    { label: "Risk Description", value: r.description, fullWidth: true },
    { label: "Causes", value: r.causes || "Not recorded", fullWidth: true },
    { label: "Potential Impact/Consequence", value: r.consequence || "Not recorded", fullWidth: true },
    {
      label: "Control Owner",
      value: [r.control_owner_departments.join(", "), ownerName(r)].filter(Boolean).join(" — "),
      fullWidth: true,
    },
    { label: "Mitigation Plans", value: r.mitigation_plan || "Not recorded", fullWidth: true },
    { label: "Implementation Timeline", value: describeTimeline(r), fullWidth: true },
  ]

  return (
    <DataTablePage
      title="Risk Register"
      description="Departmental risks, their inherent rating, control owners and mitigation plans."
      icon={ShieldAlert}
      backLink={{ href: "/admin/corporate-services/scorecard", label: "Back to Scorecard" }}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      actions={
        <div className="flex gap-2">
          {risks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportRiskRegisterToExcel(risks, { departmentCodes, staffNames })}
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              Export
            </Button>
          )}
          {raisableDepartments.length > 0 && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Add Risk
            </Button>
          )}
        </div>
      }
      stats={
        <StatGrid>
          <StatCard
            title="Red Risks Open"
            value={redCount}
            icon={AlertTriangle}
            iconBgColor="bg-red-500/10"
            iconColor="text-red-500"
          />
          <StatCard
            title="Overdue Mitigations"
            value={overdueCount}
            icon={CalendarX}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            title="Open Risks"
            value={openRisks.length}
            icon={ShieldAlert}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            title="Closed"
            value={closedCount}
            icon={CheckCircle2}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
        </StatGrid>
      }
    >
      {tab === "heat-map" ? (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="text-muted-foreground mb-4 text-center text-sm">
              Inherent position of the {openRisks.length} risk{openRisks.length === 1 ? "" : "s"} not yet closed.
            </p>
            <RiskHeatMap risks={openRisks} />
          </CardContent>
        </Card>
      ) : (
        <DataTable<RiskRow>
          data={risks}
          columns={columns}
          getRowId={(r) => r.id}
          showRowNumbers={false}
          searchPlaceholder="Search risk name, description, causes, department..."
          searchFn={(r, q) => {
            const needle = q.toLowerCase()
            return [
              reference(r),
              r.risk_name,
              r.description,
              r.causes,
              r.consequence,
              r.mitigation_plan,
              r.department,
              ...r.supporting_departments,
              ...r.control_owner_departments,
            ].some((v) => (v || "").toLowerCase().includes(needle))
          }}
          filters={filters}
          isLoading={isLoading}
          error={error ? (error instanceof Error ? error.message : "Failed to load the risk register") : null}
          onRetry={refetch}
          pagination={{ pageSize: 25 }}
          emptyIcon={ShieldAlert}
          emptyTitle="No risks recorded"
          emptyDescription="Risks added from the ACOB Risk Register template appear here."
          rowActions={[
            { label: "Edit", icon: Pencil, onClick: openEdit, hidden: (r) => !canEdit(r) },
            { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting, hidden: () => !isAdminLike },
          ]}
          viewToggle
          contactsView
          stickyToolbar
          defaultViewMode={{ mobile: "contacts", desktop: "list" }}
          cardRenderer={(r) => (
            <RiskCard risk={r} reference={reference(r)} today={today} canEdit={canEdit(r)} onEdit={() => openEdit(r)} />
          )}
          mobileRow={{
            title: (r) => r.risk_name,
            subtitle: (r) => `${reference(r)} · ${describeTimeline(r)}`,
            trailing: (r) => <RatingBadge rating={r.rating} score={r.score} className="text-[10px]" />,
            detail: {
              title: (r) => r.risk_name,
              subtitle: (r) => reference(r),
              badges: (r) => (
                <div className="flex flex-wrap items-center gap-1.5">
                  <RatingBadge rating={r.rating} score={r.score} className="text-[10px]" />
                  <StatusBadge status={r.status} className="text-[10px]" />
                  {isRiskOverdue(r, today) && (
                    <Badge variant="outline" className="border-rose-300 text-[10px] text-rose-700 dark:text-rose-300">
                      Overdue
                    </Badge>
                  )}
                </div>
              ),
              fields: detailFields,
              actions: (r) => (canEdit(r) ? [{ label: "Edit", icon: Pencil, onClick: () => openEdit(r) }] : []),
            },
          }}
          urlSync
          expandable={{
            render: (r) => (
              <div className="bg-muted/20 grid grid-cols-1 gap-4 border-t p-4 md:grid-cols-2">
                <DetailBlock label="Risk Description" value={r.description} />
                <DetailBlock label="Causes" value={r.causes} />
                <DetailBlock label="Potential Impact/Consequence" value={r.consequence} />
                <DetailBlock label="Mitigation Plans" value={r.mitigation_plan} />
                <DetailBlock
                  label="Inherent Impact × Likelihood"
                  value={`${r.impact} ${impactLabel(r.impact)} × ${r.likelihood} ${likelihoodLabel(r.likelihood)} = ${r.score}`}
                />
                <DetailBlock label="Implementation Timeline" value={describeTimeline(r)} />
              </div>
            ),
          }}
        />
      )}

      <RiskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        risk={editing}
        departments={departmentNames}
        raisableDepartments={raisableDepartments}
        staff={staff}
        ownerOnly={editing ? !canEditAll(editing) : false}
        onSaved={handleSaved}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Risk</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `"${deleting.risk_name}" (${reference(deleting)})` : "This risk"} will be removed from the
              register. Close it instead if it is no longer active, so the record is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DataTablePage>
  )
}
