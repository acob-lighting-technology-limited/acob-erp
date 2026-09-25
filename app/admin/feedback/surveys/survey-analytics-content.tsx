"use client"

import { useEffect, useMemo, useState } from "react"
import { Star, Download, Gauge, Sparkles, Users, Eye, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react"
import { toast } from "sonner"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { apiFetch } from "@/lib/api-client"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { logger } from "@/lib/logger"
import type { SurveyMetrics } from "@/types/survey"
import type { AdminSurveyItem } from "@/app/api/admin/feedback/surveys/route"

const log = logger("survey-analytics-content")

const RATING_OPTIONS = [
  { value: "5", label: "5 Stars (Excellent)" },
  { value: "4", label: "4 Stars (Good)" },
  { value: "3", label: "3 Stars (Average)" },
  { value: "2", label: "2 Stars (Poor)" },
  { value: "1", label: "1 Star (Very Poor)" },
]

const ANON_OPTIONS = [
  { value: "true", label: "Anonymous Submissions" },
  { value: "false", label: "Named Submissions" },
]

export function SurveyAnalyticsContent() {
  const [surveys, setSurveys] = useState<AdminSurveyItem[]>([])
  const [metrics, setMetrics] = useState<SurveyMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSurvey, setSelectedSurvey] = useState<AdminSurveyItem | null>(null)

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch("/api/admin/feedback/surveys", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load survey data")
      const json = await res.json()
      setSurveys(json.data || [])
      setMetrics(json.metrics || null)
    } catch (err) {
      log.error({ err: String(err) }, "Failed to fetch admin surveys")
      setError("Unable to load surveys. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const s of surveys) {
      if (s.department) set.add(s.department)
    }
    return Array.from(set).sort()
  }, [surveys])

  const columns: DataTableColumn<AdminSurveyItem>[] = [
    {
      key: "respondent",
      label: "Respondent",
      sortable: true,
      resizable: true,
      initialWidth: 180,
      accessor: (r) => (r.is_anonymous ? "Anonymous Staff" : r.respondent_name || "Employee"),
      render: (r) => (
        <div className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ${
              r.is_anonymous
                ? "bg-muted text-muted-foreground ring-border"
                : "bg-primary/10 text-primary ring-primary/20"
            }`}
          >
            {r.is_anonymous ? "A" : (r.respondent_name || "E").charAt(0)}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium">
              {r.is_anonymous ? "Anonymous Staff" : r.respondent_name || "Employee"}
            </span>
            {r.role && <span className="text-muted-foreground truncate text-[10px]">{r.role}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "department",
      label: "Department",
      sortable: true,
      resizable: true,
      initialWidth: 150,
      accessor: (r) => r.department || "Unassigned",
      render: (r) => <span className="text-xs font-medium">{r.department || "—"}</span>,
    },
    {
      key: "overall_rating",
      label: "Overall CSAT",
      sortable: true,
      resizable: true,
      initialWidth: 130,
      accessor: (r) => r.overall_rating,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-3 w-3 ${
                  s <= r.overall_rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-semibold">{r.overall_rating}.0</span>
        </div>
      ),
    },
    {
      key: "speed_rating",
      label: "Speed",
      sortable: true,
      resizable: true,
      initialWidth: 100,
      accessor: (r) => r.speed_rating,
      render: (r) => <span className="font-mono text-xs font-medium">{r.speed_rating} / 5</span>,
    },
    {
      key: "usability_rating",
      label: "Usability",
      sortable: true,
      resizable: true,
      initialWidth: 100,
      accessor: (r) => r.usability_rating,
      render: (r) => <span className="font-mono text-xs font-medium">{r.usability_rating} / 5</span>,
    },
    {
      key: "training_rating",
      label: "Training",
      sortable: true,
      resizable: true,
      initialWidth: 120,
      accessor: (r) => r.training_rating || "Not stated",
      render: (r) => {
        if (!r.training_rating) return <span className="text-muted-foreground text-xs">—</span>
        if (r.training_rating === "adequate") {
          return (
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 text-[10px] text-emerald-700">
              Adequate
            </Badge>
          )
        }
        if (r.training_rating === "somewhat") {
          return (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-50 text-[10px] text-amber-700">
              Somewhat
            </Badge>
          )
        }
        return (
          <Badge variant="outline" className="border-rose-500/30 bg-rose-50 text-[10px] text-rose-700">
            Inadequate
          </Badge>
        )
      },
    },
    {
      key: "created_at",
      label: "Date",
      sortable: true,
      resizable: true,
      initialWidth: 120,
      accessor: (r) => r.created_at,
      render: (r) => <span className="text-muted-foreground font-mono text-xs">{formatWATDate(r.created_at)}</span>,
    },
  ]

  const filters: DataTableFilter<AdminSurveyItem>[] = [
    {
      key: "department",
      label: "Department",
      options: departments.map((d) => ({ value: d, label: d })),
      mode: "column",
    },
    {
      key: "overall_rating",
      label: "CSAT Rating",
      options: RATING_OPTIONS,
      mode: "custom",
      filterFn: (row, val) =>
        Array.isArray(val) ? val.includes(String(row.overall_rating)) : String(row.overall_rating) === val,
    },
    {
      key: "is_anonymous",
      label: "Submission Type",
      options: ANON_OPTIONS,
      mode: "custom",
      filterFn: (row, val) =>
        Array.isArray(val) ? val.includes(String(row.is_anonymous)) : String(row.is_anonymous) === val,
    },
  ]

  const handleExportCsv = () => {
    if (surveys.length === 0) {
      toast.error("No survey responses to export")
      return
    }

    const headers = [
      "ID",
      "Respondent",
      "Department",
      "Role",
      "Overall Rating",
      "Speed Rating",
      "Usability Rating",
      "Training Rating",
      "Frustrations",
      "Desired Features",
      "Anonymous",
      "Date Submitted",
    ]

    const rows = surveys.map((s) => [
      s.id,
      `"${(s.respondent_name || "Anonymous Staff").replace(/"/g, '""')}"`,
      `"${(s.department || "").replace(/"/g, '""')}"`,
      `"${(s.role || "").replace(/"/g, '""')}"`,
      s.overall_rating,
      s.speed_rating,
      s.usability_rating,
      `"${(s.training_rating || "").replace(/"/g, '""')}"`,
      `"${(s.biggest_frustration || "").replace(/"/g, '""')}"`,
      `"${(s.desired_features || "").replace(/"/g, '""')}"`,
      s.is_anonymous ? "Yes" : "No",
      s.created_at,
    ])

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `acob_matrix_surveys_${toLocalISODate(new Date())}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success("Surveys exported to CSV successfully")
  }

  return (
    <DataTablePage
      title="System Satisfaction & Adoption Surveys"
      description="Monitor post-deployment usability, system speed, module adoption, and employee feedback."
      icon={Star}
      backLink={{ href: "/admin/feedback", label: "Back to Feedback Management" }}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Total Responses"
            value={metrics?.totalResponses ?? surveys.length}
            icon={Users}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Average CSAT"
            value={`${metrics?.averageOverall ?? 0} / 5.0`}
            icon={Star}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            variant="compact"
            title="Speed Rating"
            value={`${metrics?.averageSpeed ?? 0} / 5.0`}
            icon={Gauge}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            variant="compact"
            title="Usability Score"
            value={`${metrics?.averageUsability ?? 0} / 5.0`}
            icon={Sparkles}
            iconBgColor="bg-purple-500/10"
            iconColor="text-purple-500"
          />
        </StatGrid>
      }
    >
      <DataTable<AdminSurveyItem>
        data={surveys}
        columns={columns}
        filters={filters}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        error={error}
        onRetry={loadData}
        searchPlaceholder="Search respondent, department, role, or comments..."
        searchFn={(r, q) =>
          `${r.respondent_name || ""} ${r.department || ""} ${r.role || ""} ${r.biggest_frustration || ""} ${
            r.desired_features || ""
          }`
            .toLowerCase()
            .includes(q)
        }
        pagination={{ pageSize: 50 }}
        stickyToolbar
        viewToggle
        contactsView
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => (r.is_anonymous ? "Anonymous Staff" : r.respondent_name || "Employee"),
          subtitle: (r) => `${r.department || "No Department"} · CSAT: ${r.overall_rating}/5`,
          trailing: (r) => (
            <Badge variant="outline" className="text-[10px]">
              {r.overall_rating} ★
            </Badge>
          ),
          detail: {
            title: (r) => (r.is_anonymous ? "Anonymous Staff" : r.respondent_name || "Employee"),
            subtitle: (r) => `${r.department || "No Dept"} · ${formatWATDate(r.created_at)}`,
            fields: (r) => [
              { label: "Overall CSAT", value: `${r.overall_rating} of 5` },
              { label: "Speed Rating", value: `${r.speed_rating} of 5` },
              { label: "Usability Rating", value: `${r.usability_rating} of 5` },
              { label: "Training", value: r.training_rating || "—" },
              ...(r.biggest_frustration
                ? [{ label: "Frustrations", value: r.biggest_frustration, fullWidth: true }]
                : []),
              ...(r.desired_features
                ? [{ label: "Desired Features", value: r.desired_features, fullWidth: true }]
                : []),
            ],
            actions: (r) => [
              {
                label: "View Details",
                icon: Eye,
                onClick: () => setSelectedSurvey(r),
              },
            ],
          },
        }}
        rowActions={[
          {
            label: "View Details",
            icon: Eye,
            onClick: (r) => setSelectedSurvey(r),
          },
        ]}
        emptyTitle="No survey responses yet"
        emptyDescription="Employee satisfaction responses will appear here as users submit them."
        emptyIcon={Star}
        skeletonRows={5}
        urlSync
      />

      {/* Survey Detail Dialog */}
      {selectedSurvey && (
        <Dialog open={Boolean(selectedSurvey)} onOpenChange={(open) => !open && setSelectedSurvey(null)}>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <Star className="h-4 w-4 fill-amber-500" />
                </span>
                <div>
                  <DialogTitle className="text-base">Survey Response Details</DialogTitle>
                  <DialogDescription className="text-xs">
                    Submitted on {formatWATDate(selectedSurvey.created_at)}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="bg-muted/20 grid grid-cols-2 gap-3 rounded-lg border p-3">
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Respondent</span>
                  <span className="text-sm font-medium">
                    {selectedSurvey.is_anonymous ? "Anonymous Staff" : selectedSurvey.respondent_name || "Employee"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Department</span>
                  <span className="text-sm font-medium">{selectedSurvey.department || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Role</span>
                  <span className="font-medium">{selectedSurvey.role || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                    Submission Type
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedSurvey.is_anonymous ? "Anonymous" : "Attributed"}
                  </Badge>
                </div>
              </div>

              {/* Ratings Summary */}
              <div className="space-y-2 rounded-lg border p-3">
                <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Core Metrics</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/40 rounded-md p-2 text-center">
                    <span className="text-muted-foreground block text-[10px]">Overall CSAT</span>
                    <span className="text-base font-bold text-amber-500">{selectedSurvey.overall_rating} / 5</span>
                  </div>
                  <div className="bg-muted/40 rounded-md p-2 text-center">
                    <span className="text-muted-foreground block text-[10px]">Speed</span>
                    <span className="text-base font-bold text-emerald-500">{selectedSurvey.speed_rating} / 5</span>
                  </div>
                  <div className="bg-muted/40 rounded-md p-2 text-center">
                    <span className="text-muted-foreground block text-[10px]">Usability</span>
                    <span className="text-base font-bold text-purple-500">{selectedSurvey.usability_rating} / 5</span>
                  </div>
                </div>
              </div>

              {/* Module Ratings */}
              {selectedSurvey.module_ratings && Object.keys(selectedSurvey.module_ratings).length > 0 && (
                <div className="space-y-2 rounded-lg border p-3">
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                    Module Ratings
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedSurvey.module_ratings).map(([mod, r]) => (
                      <div key={mod} className="bg-muted/40 flex items-center justify-between rounded px-2.5 py-1.5">
                        <span className="text-[11px] font-medium capitalize">{mod.replace(/_/g, " ")}</span>
                        <span className="text-xs font-semibold text-amber-600">{r} ★</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Training */}
              <div className="space-y-1 rounded-lg border p-3">
                <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                  Training Adequacy
                </span>
                <p className="font-medium capitalize">{selectedSurvey.training_rating || "Not specified"}</p>
              </div>

              {/* Qualitative Answers */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-muted-foreground block flex items-center gap-1 text-[10px] font-semibold uppercase">
                    <AlertTriangle className="h-3 w-3 text-amber-500" /> Biggest Frustration / Blocker
                  </span>
                  <p className="bg-background rounded-md border p-2.5 leading-relaxed whitespace-pre-wrap">
                    {selectedSurvey.biggest_frustration || "No frustration reported."}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground block flex items-center gap-1 text-[10px] font-semibold uppercase">
                    <Sparkles className="h-3 w-3 text-purple-500" /> Desired Features / Improvements
                  </span>
                  <p className="bg-background rounded-md border p-2.5 leading-relaxed whitespace-pre-wrap">
                    {selectedSurvey.desired_features || "No feature requests reported."}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DataTablePage>
  )
}
