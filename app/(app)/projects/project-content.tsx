"use client"

import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableDetailField, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Progress } from "@/components/ui/progress"
import {
  FolderGit2,
  FolderKanban,
  RefreshCw,
  Calendar,
  MapPin,
  Wrench,
  ShieldCheck,
  Briefcase,
  Activity,
  Layers,
} from "lucide-react"
import { ProjectTaskViewer } from "./_components/project-task-viewer"
import {
  PROJECT_HEALTH_LABELS,
  PROJECT_METRIC_HELP,
  computeProjectHealth,
  type ProjectHealthTask,
} from "@/lib/projects/health"
import { HealthBadge, ProjectSummary, formatCapacity, formatVariance } from "@/components/projects/project-summary"
import { toLocalISODate } from "@/lib/utils/date"

// Define user-facing project type (includes tasks count payload)
export interface ProjectRow {
  id: string
  project_name: string
  location: string
  deployment_start_date: string
  deployment_end_date: string
  capacity_w: number | null
  technology_type: string | null
  project_manager_id: string | null
  description: string | null
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled"
  created_at: string
  updated_at: string
  portfolio_id?: string | null
  project_manager?: {
    id: string
    full_name: string | null
    first_name: string | null
    last_name: string | null
  } | null
  portfolio?: { id: string; name: string; code: string | null } | null
  tasks?: ProjectHealthTask[]
}

export interface ProjectContentProps {
  currentUser?: {
    id: string
    role: string
    is_department_lead: boolean
    department: string | null
  }
}

async function fetchUserProjects(): Promise<ProjectRow[]> {
  const res = await fetch("/api/projects", { cache: "no-store" })
  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload?.error || `Failed to load projects (${res.status})`)
  }
  return (payload?.data || []) as ProjectRow[]
}

export function ProjectContent({ currentUser: _currentUser }: ProjectContentProps = {}) {
  const queryClient = useQueryClient()

  // Fetch project list
  const {
    data: rows = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["user-projects"],
    queryFn: fetchUserProjects,
  })

  // Calculate project summary statistics
  const stats = useMemo(() => {
    const total = rows.length
    const active = rows.filter((r) => r.status === "active").length
    const completed = rows.filter((r) => r.status === "completed").length
    const totalCapacityWatts = rows.reduce((sum, r) => sum + (r.capacity_w || 0), 0)
    return {
      total,
      active,
      completed,
      totalCapacity: formatCapacity(totalCapacityWatts),
    }
  }, [rows])

  // Technology Types option list for filtering
  const techOptions = useMemo(() => {
    const types = Array.from(new Set(rows.map((r) => r.technology_type).filter(Boolean)))
    return types.sort().map((t) => ({ value: t!, label: t! }))
  }, [rows])

  // Weighted delivery and health, from the same helper the admin project and
  // portfolio dashboards use — a count of finished tasks would report a
  // different number for the same project depending on which page you opened.
  const healthById = useMemo(() => {
    const today = toLocalISODate()
    return new Map(
      rows.map((project) => [
        project.id,
        computeProjectHealth({
          startDate: project.deployment_start_date,
          endDate: project.deployment_end_date,
          tasks: project.tasks || [],
          today,
        }),
      ])
    )
  }, [rows])

  const getProgressInfo = (project: ProjectRow) => {
    const health = healthById.get(project.id)
    if (!health || health.taskCount === 0) return { percent: 0, text: "No tasks" }
    return { percent: health.deliveryPct ?? 0, text: `${health.qualityPct ?? 0}% quality` }
  }

  // Project Status Badge formatter
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">Ongoing</Badge>
      case "completed":
        return <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-500">Completed</Badge>
      case "planning":
        return <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-500">Planning</Badge>
      case "on_hold":
        return <Badge className="border-red-500/20 bg-red-500/10 text-red-500">On Hold</Badge>
      case "cancelled":
        return <Badge className="border-slate-500/20 bg-slate-500/10 text-slate-500">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Table columns definition
  const columns = useMemo<DataTableColumn<ProjectRow>[]>(
    () => [
      {
        key: "project_name",
        label: "Project Title",
        sortable: true,
        accessor: (r) => r.project_name,
        render: (r) => (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-foreground font-semibold">{r.project_name}</p>
              {r.portfolio && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {r.portfolio.code || r.portfolio.name}
                </Badge>
              )}
            </div>
            {r.description && <p className="text-muted-foreground line-clamp-1 text-xs">{r.description}</p>}
          </div>
        ),
      },
      {
        key: "location",
        label: "Site Location",
        sortable: true,
        accessor: (r) => r.location,
        render: (r) => (
          <div className="flex items-center gap-1.5 text-sm">
            <MapPin className="text-muted-foreground h-3.5 w-3.5" />
            <span>{r.location}</span>
          </div>
        ),
      },
      {
        key: "progress",
        label: "Delivery / Quality",
        description: PROJECT_METRIC_HELP.deliveryQuality,
        sortable: false,
        render: (r) => {
          const info = getProgressInfo(r)
          return (
            <div className="max-w-[180px] min-w-[120px] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>{info.percent}%</span>
                <span className="text-muted-foreground">{info.text}</span>
              </div>
              <Progress value={info.percent} className="h-1.5" />
            </div>
          )
        },
      },
      {
        key: "project_manager",
        label: "Project Manager",
        sortable: true,
        accessor: (r) => r.project_manager?.full_name || "",
        render: (r) => (
          <div className="flex items-center gap-1.5 text-sm">
            <Briefcase className="text-muted-foreground h-3.5 w-3.5" />
            <span>
              {r.project_manager?.full_name ||
                [r.project_manager?.first_name, r.project_manager?.last_name].filter(Boolean).join(" ") ||
                "Unassigned"}
            </span>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        description: PROJECT_METRIC_HELP.status,
        sortable: true,
        accessor: (r) => r.status,
        render: (r) => renderStatusBadge(r.status),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getProgressInfo reads healthById
    [healthById]
  )

  // Portfolio option list for filtering
  const portfolioOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      if (r.portfolio) {
        map.set(r.portfolio.id, r.portfolio.code ? `${r.portfolio.code} — ${r.portfolio.name}` : r.portfolio.name)
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }))
  }, [rows])

  // Filters definition
  const filters = useMemo<DataTableFilter<ProjectRow>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        options: [
          { value: "planning", label: "Planning" },
          { value: "active", label: "Ongoing" },
          { value: "on_hold", label: "On Hold" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
        ],
      },
      {
        key: "technology_type",
        label: "Technology",
        options: techOptions,
        // The technology column lives in the expanded view, so match on the row.
        mode: "custom",
        filterFn: (row, selected) => selected.includes(row.technology_type || ""),
      },
      {
        key: "health",
        label: "Health",
        options: [
          { value: "on_track", label: PROJECT_HEALTH_LABELS.on_track },
          { value: "at_risk", label: PROJECT_HEALTH_LABELS.at_risk },
          { value: "behind_schedule", label: PROJECT_HEALTH_LABELS.behind_schedule },
          { value: "completed", label: PROJECT_HEALTH_LABELS.completed },
        ],
        mode: "custom",
        filterFn: (row, selected) => selected.includes(healthById.get(row.id)?.status ?? "on_track"),
      },
      ...(portfolioOptions.length > 0
        ? [
            {
              key: "portfolio",
              label: "Portfolio",
              options: portfolioOptions,
              mode: "custom" as const,
              filterFn: (row: ProjectRow, selected: string[]) =>
                selected.length === 0 || (row.portfolio?.id ? selected.includes(row.portfolio.id) : false),
            },
          ]
        : []),
    ],
    [techOptions, portfolioOptions, healthById]
  )

  return (
    <DataTablePage
      title="Projects &amp; Deployments"
      description="View ongoing mini-grid electrification and solar installations progress and task milestones."
      spacing="tight"
      actionsPlacement="inline-always"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["user-projects"] })}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Assigned Projects"
            value={stats.total}
            icon={FolderKanban}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Ongoing Status"
            value={stats.active}
            icon={Wrench}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            variant="compact"
            title="Completed Scope"
            value={stats.completed}
            icon={ShieldCheck}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            variant="compact"
            title="Cumulative Capacity"
            value={stats.totalCapacity}
            icon={FolderGit2}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
          />
        </StatGrid>
      }
    >
      <DataTable<ProjectRow>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(r) => r.id}
        searchPlaceholder="Search project title or site location..."
        searchFn={(row, query) => {
          const q = query.toLowerCase()
          return (
            row.project_name.toLowerCase().includes(q) ||
            row.location.toLowerCase().includes(q) ||
            (row.description || "").toLowerCase().includes(q)
          )
        }}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={refetch}
        viewToggle
        stickyToolbar
        contactsView
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => r.project_name,
          subtitle: (r) => [r.location, r.technology_type].filter(Boolean).join(" · ") || r.location,
          trailing: (r) => renderStatusBadge(r.status),
          detail: {
            title: (r) => r.project_name,
            subtitle: (r) => <span className="text-muted-foreground text-xs">{r.location}</span>,
            badges: (r) => {
              const health = healthById.get(r.id)
              return (
                <>
                  {renderStatusBadge(r.status)}
                  {health && <HealthBadge status={health.status} />}
                </>
              )
            },
            fields: (r) => {
              const info = getProgressInfo(r)
              const health = healthById.get(r.id)
              const pct = (value: number | null | undefined) =>
                value === null || value === undefined ? null : `${value}%`
              const fields: DataTableDetailField[] = [
                { icon: MapPin, label: "Location", value: r.location },
                {
                  icon: Briefcase,
                  label: "Project manager",
                  value:
                    r.project_manager?.full_name ||
                    [r.project_manager?.first_name, r.project_manager?.last_name].filter(Boolean).join(" ") ||
                    "Unassigned",
                },
                { icon: Wrench, label: "Technology", value: r.technology_type },
                {
                  icon: FolderGit2,
                  label: "Capacity",
                  value: r.capacity_w === null ? null : formatCapacity(r.capacity_w),
                },
                { icon: Layers, label: "Portfolio", value: r.portfolio?.name, copyable: false },
                {
                  icon: Calendar,
                  label: "Schedule",
                  value: `${r.deployment_start_date} → ${r.deployment_end_date}`,
                  copyable: false,
                },
                { label: "Delivery progress", value: `${info.percent}% — ${info.text}`, copyable: false },
                {
                  icon: Activity,
                  label: "Health",
                  value: health ? PROJECT_HEALTH_LABELS[health.status] : null,
                  copyable: false,
                },
                { label: "Elapsed", value: pct(health?.timeElapsedPct), copyable: false },
                { label: "Variance", value: formatVariance(health?.variancePct), copyable: false },
                { label: "Overdue tasks", value: health ? String(health.overdueCount) : null, copyable: false },
                { icon: FolderKanban, label: "Description", value: r.description, fullWidth: true },
              ]
              return fields.filter((field) => field.value)
            },
          },
        }}
        cardRenderer={(r) => {
          const info = getProgressInfo(r)
          return (
            <div className="group bg-card text-card-foreground border-border/60 hover:border-primary/40 h-full space-y-3 rounded-xl border p-4 shadow-sm transition-all">
              <div className="flex items-start justify-between gap-2">
                <h4 className="line-clamp-2 text-sm font-semibold">{r.project_name}</h4>
                {renderStatusBadge(r.status)}
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium uppercase">Location</p>
                  <p className="font-medium">{r.location || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium uppercase">Technology</p>
                  <p className="font-medium">{r.technology_type || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium uppercase">Capacity</p>
                  <p className="font-medium">{formatCapacity(r.capacity_w)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium uppercase">Progress</p>
                  <p className="font-medium">{info.percent}%</p>
                </div>
              </div>
              <div className="border-border/40 text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
                <span>
                  {r.project_manager?.full_name ||
                    [r.project_manager?.first_name, r.project_manager?.last_name].filter(Boolean).join(" ") ||
                    "Unassigned"}
                </span>
                <span>{info.text}</span>
              </div>
            </div>
          )
        }}
        expandable={{
          render: (r) => (
            <div className="bg-muted/20 space-y-3 rounded-lg border p-2">
              <ProjectSummary project={r} health={healthById.get(r.id)} />
              <ProjectTaskViewer projectId={r.id} projectName={r.project_name} />
            </div>
          ),
        }}
        emptyTitle="No Projects Assigned"
        emptyDescription="You will see projects here once you are assigned as a manager or member."
        emptyIcon={FolderKanban}
        urlSync
      />
    </DataTablePage>
  )
}
