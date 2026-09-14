"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Clock, Download, ExternalLink, Pencil, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { cn } from "@/lib/utils"
import { toLocalISODate } from "@/lib/utils/date"
import { EditRiskDialog, type RiskItem } from "./edit-risk-dialog"
import { RiskCard } from "./risk-card"
import { apiFetch } from "@/lib/api-client"

interface RiskRegisterViewProps {
  departments: string[]
  employees: Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>
  userRole?: string
}

export function RiskRegisterView({ departments, employees, userRole }: RiskRegisterViewProps) {
  const queryClient = useQueryClient()
  const queryKey = ["corporate-services-risk-register"]

  const [editingRisk, setEditingRisk] = useState<RiskItem | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const { data, isLoading, error, refetch } = useQuery<{ data: RiskItem[] }>({
    queryKey,
    queryFn: async () => {
      const res = await apiFetch("/api/corporate-services/risk-register", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load risk register")
      return res.json()
    },
  })

  const risks: RiskItem[] = data?.data || []

  // Metric computations
  const totalRisks = risks.length
  const criticalHighCount = risks.filter((r) => r.severity === "critical" || r.severity === "high").length
  const mitigatingCount = risks.filter((r) => r.status === "mitigating").length
  const resolvedCount = risks.filter((r) => r.status === "resolved" || r.status === "closed").length

  function handleOpenEdit(risk: RiskItem) {
    setEditingRisk(risk)
    setIsEditOpen(true)
  }

  function handleRiskSaved(updated: RiskItem) {
    queryClient.setQueryData<{ data: RiskItem[] }>(queryKey, (old) => {
      if (!old) return { data: [updated] }
      return {
        data: old.data.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      }
    })
  }

  const columns: DataTableColumn<RiskItem>[] = [
    {
      key: "title",
      label: "Risk / Challenge",
      sortable: true,
      accessor: (r) => r.title,
      render: (r) => (
        <div className="space-y-1 py-1">
          <p className="text-foreground line-clamp-2 text-sm font-medium">{r.title}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
            {r.report_id ? (
              <Badge
                variant="outline"
                className="bg-blue-50/50 px-1.5 py-0 text-[10px] font-normal text-blue-700 dark:bg-blue-950/20 dark:text-blue-300"
              >
                Weekly Report {r.week_number ? `(Wk ${r.week_number})` : ""}
              </Badge>
            ) : (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                Direct Entry
              </Badge>
            )}
            <span className="text-muted-foreground text-[11px] capitalize">{r.category}</span>
          </div>
        </div>
      ),
    },
    {
      key: "department",
      label: "Department",
      sortable: true,
      accessor: (r) => r.department || "Enterprise",
      render: (r) => (
        <Badge variant="secondary" className="text-xs font-normal whitespace-nowrap">
          {r.department || "All-Company"}
        </Badge>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      sortable: true,
      accessor: (r) => r.severity,
      render: (r) => {
        const colors = {
          critical: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50",
          high: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/50",
          medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50",
          low: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/50",
        }
        return (
          <Badge
            variant="outline"
            className={cn("text-xs font-semibold capitalize", colors[r.severity] || colors.medium)}
          >
            {r.severity || "medium"}
          </Badge>
        )
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (r) => r.status,
      render: (r) => {
        const statusBadges = {
          open: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800",
          mitigating:
            "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
          resolved:
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
          closed: "bg-muted text-muted-foreground border-muted-foreground/20",
        }
        const labels = {
          open: "Open",
          mitigating: "Mitigating",
          resolved: "Resolved",
          closed: "Closed",
        }
        return (
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium whitespace-nowrap capitalize",
              statusBadges[r.status] || statusBadges.open
            )}
          >
            {labels[r.status] || r.status}
          </Badge>
        )
      },
    },
    {
      key: "owner",
      label: "Owner",
      accessor: (r) => (r.profiles ? `${r.profiles.first_name || ""} ${r.profiles.last_name || ""}` : "Unassigned"),
      render: (r) => {
        const name = r.profiles ? [r.profiles.first_name, r.profiles.last_name].filter(Boolean).join(" ") : null
        return name ? (
          <span className="text-foreground text-xs font-medium whitespace-nowrap">{name}</span>
        ) : (
          <span className="text-muted-foreground text-xs italic">Unassigned</span>
        )
      },
      hideOnMobile: true,
    },
    {
      key: "mitigation_plan",
      label: "Mitigation Action Plan",
      accessor: (r) => r.mitigation_plan || "",
      render: (r) => (
        <span className="text-muted-foreground line-clamp-2 max-w-xs text-xs">
          {r.mitigation_plan || <span className="text-muted-foreground/50 italic">Pending mitigation plan...</span>}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
          onClick={() => handleOpenEdit(r)}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
        </Button>
      ),
    },
  ]

  const filters: DataTableFilter<RiskItem>[] = [
    {
      key: "department",
      label: "Department",
      options: [{ label: "All Departments", value: "" }, ...departments.map((d) => ({ label: d, value: d }))],
      mode: "column",
    },
    {
      key: "severity",
      label: "Severity",
      options: [
        { label: "All Severities", value: "" },
        { label: "Critical", value: "critical" },
        { label: "High", value: "high" },
        { label: "Medium", value: "medium" },
        { label: "Low", value: "low" },
      ],
      mode: "column",
    },
    {
      key: "status",
      label: "Status",
      options: [
        { label: "All Statuses", value: "" },
        { label: "Open (Unmitigated)", value: "open" },
        { label: "Mitigating (In Progress)", value: "mitigating" },
        { label: "Resolved", value: "resolved" },
        { label: "Closed / Archived", value: "closed" },
      ],
      mode: "column",
    },
    {
      key: "category",
      label: "Category",
      options: [
        { label: "All Categories", value: "" },
        { label: "Operational", value: "operational" },
        { label: "Financial", value: "financial" },
        { label: "Strategic", value: "strategic" },
        { label: "Compliance & Legal", value: "compliance" },
        { label: "Technical", value: "technical" },
        { label: "Health & Safety", value: "health_safety" },
        { label: "Reputational", value: "reputational" },
      ],
      mode: "column",
    },
  ]

  const handleExportCsv = () => {
    if (risks.length === 0) return
    const headers = ["Title", "Department", "Category", "Severity", "Status", "Mitigation Plan", "Contingency Plan"]
    const lines = risks.map((r) => [
      `"${(r.title || "").replace(/"/g, '""')}"`,
      `"${r.department || "Enterprise"}"`,
      `"${r.category}"`,
      `"${r.severity}"`,
      `"${r.status}"`,
      `"${(r.mitigation_plan || "").replace(/"/g, '""')}"`,
      `"${(r.contingency_plan || "").replace(/"/g, '""')}"`,
    ])
    const csvContent = [headers.join(","), ...lines.map((l) => l.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `risk-register-${toLocalISODate()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <DataTablePage
      title="Risk Register"
      description="Enterprise and departmental risk matrix, tracking operational challenges and strategic mitigations."
      icon={ShieldAlert}
      backLink={{ href: "/admin/corporate-services/scorecard", label: "Back to Scorecard" }}
      actions={
        risks.length > 0 ? (
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden />
            Export
          </Button>
        ) : undefined
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Total Tracked Risks"
            value={totalRisks}
            icon={ShieldAlert}
            iconBgColor="bg-slate-500/10"
            iconColor="text-slate-600 dark:text-slate-400"
          />
          <StatCard
            variant="compact"
            title="Critical & High"
            value={criticalHighCount}
            icon={AlertTriangle}
            iconBgColor="bg-rose-500/10"
            iconColor="text-rose-600 dark:text-rose-400"
          />
          <StatCard
            variant="compact"
            title="In Mitigation"
            value={mitigatingCount}
            icon={Clock}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            variant="compact"
            title="Resolved / Closed"
            value={resolvedCount}
            icon={CheckCircle2}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
        </StatGrid>
      }
    >
      <DataTable<RiskItem>
        data={risks}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search risk title, department, or mitigation plan..."
        searchFn={(row, q) =>
          row.title.toLowerCase().includes(q.toLowerCase()) ||
          (row.department || "").toLowerCase().includes(q.toLowerCase()) ||
          (row.mitigation_plan || "").toLowerCase().includes(q.toLowerCase())
        }
        filters={filters}
        isLoading={isLoading}
        error={error ? (error instanceof Error ? error.message : "Failed to load risk register") : null}
        onRetry={refetch}
        pagination={{ pageSize: 25 }}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        cardRenderer={(risk) => <RiskCard risk={risk} onEdit={() => handleOpenEdit(risk)} />}
        mobileRow={{
          title: (r) => r.title,
          subtitle: (r) => {
            const parts = [
              r.department || "Enterprise",
              r.category,
              r.report_id && r.week_number ? `Week ${r.week_number}` : null,
            ].filter(Boolean)
            return parts.join(" · ")
          },
          trailing: (r) => (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] font-medium capitalize">
                {r.severity}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-medium capitalize">
                {r.status}
              </Badge>
            </div>
          ),
          onSelect: (r) => handleOpenEdit(r),
          detail: {
            title: (r) => r.title,
            subtitle: (r) => r.department || "Enterprise",
            badges: (r) => (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] capitalize">
                  {r.severity}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {r.status}
                </Badge>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {r.category}
                </Badge>
              </div>
            ),
            fields: (r) => [
              { label: "Department", value: r.department || "Enterprise" },
              { label: "Category", value: r.category },
              { label: "Severity", value: r.severity },
              { label: "Status", value: r.status },
              { label: "Mitigation Plan", value: r.mitigation_plan || "None recorded", fullWidth: true },
              { label: "Contingency Plan", value: r.contingency_plan || "None recorded", fullWidth: true },
            ],
            actions: (r) => [
              {
                label: "Edit",
                icon: Pencil,
                onClick: () => handleOpenEdit(r),
              },
            ],
          },
        }}
        urlSync
        expandable={{
          render: (r) => (
            <div className="bg-muted/20 space-y-3 border-t p-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs font-semibold uppercase">
                  Full Challenge / Risk Detail
                </span>
                <p className="text-foreground mt-1">{r.title}</p>
                {r.description && <p className="text-muted-foreground mt-1 text-xs">{r.description}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 border-t pt-2 md:grid-cols-2">
                <div>
                  <span className="text-muted-foreground text-xs font-semibold uppercase">Mitigation Action Plan</span>
                  <p className="text-foreground mt-1 text-xs">
                    {r.mitigation_plan || (
                      <span className="text-muted-foreground italic">
                        No mitigation plan recorded yet. Click Edit to assign an owner and plan.
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-semibold uppercase">Contingency Plan</span>
                  <p className="text-foreground mt-1 text-xs">
                    {r.contingency_plan || (
                      <span className="text-muted-foreground italic">No contingency plan recorded.</span>
                    )}
                  </p>
                </div>
              </div>

              {r.report_id && (
                <div className="border-t pt-2 text-xs">
                  <Link
                    href={`/admin/reports/general-meeting/weekly-reports?week=${r.week_number}&year=${r.year}&dept=${r.department}`}
                    target="_blank"
                    className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> View Original Weekly Report (Week {r.week_number}, {r.year}
                    )
                  </Link>
                </div>
              )}
            </div>
          ),
        }}
      />

      <EditRiskDialog
        risk={editingRisk}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        employees={employees}
        onRiskUpdated={handleRiskSaved}
      />
    </DataTablePage>
  )
}
