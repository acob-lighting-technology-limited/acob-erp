"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableDetailField, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { QUERY_KEYS } from "@/lib/query-keys"
import {
  FolderGit2,
  FolderKanban,
  Plus,
  RefreshCw,
  Calendar,
  MapPin,
  Wrench,
  ShieldCheck,
  Briefcase,
  Pencil,
  Activity,
  Layers,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import type { employee } from "@/app/admin/tasks/management/admin-tasks-content"
import { ProjectDialogs } from "./project-dialogs"
import {
  PROJECT_HEALTH_LABELS,
  PROJECT_METRIC_HELP,
  computeProjectHealth,
  type ProjectHealthTask,
} from "@/lib/projects/health"
import {
  HealthBadge,
  ProjectStatusBadge,
  ProjectSummary,
  ProjectStatusBar,
  formatCapacity,
  formatVariance,
} from "@/components/projects/project-summary"
import { toLocalISODate } from "@/lib/utils/date"
import { Progress } from "@/components/ui/progress"
import { ProjectPlanBoard } from "./project-plan-board"

// Define core project structure
export interface Project {
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
  portfolio_id: string | null
  project_manager?: {
    id: string
    full_name: string | null
    first_name: string | null
    last_name: string | null
  } | null
  portfolio?: { id: string; name: string; code: string | null } | null
  /** Returned with the project so progress can be derived without a second call. */
  tasks?: ProjectHealthTask[] | null
}

interface ProjectAdminContentProps {
  profiles: employee[]
  currentUser: { id: string; role: string; department: string | null }
}

function managerName(project: Project) {
  return (
    project.project_manager?.full_name ||
    [project.project_manager?.first_name, project.project_manager?.last_name].filter(Boolean).join(" ") ||
    "Unassigned"
  )
}

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects", { cache: "no-store" })
  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload?.error || `Failed to load projects (${res.status})`)
  }
  return (payload?.data || []) as Project[]
}

function getProjectTaskCounts(tasks: ProjectHealthTask[] = []) {
  const today = toLocalISODate()
  let completed = 0
  let inProgress = 0
  let overdue = 0
  let pending = 0
  for (const t of tasks) {
    if (t.is_archived) continue
    const status = String(t.status || "").toLowerCase()
    const deadline = t.task_end_date || t.due_date
    const isPastDue =
      deadline &&
      String(deadline).slice(0, 10) < today &&
      status !== "completed" &&
      status !== "cancelled" &&
      status !== "reassigned"
    if (status === "completed") {
      completed++
    } else if (isPastDue) {
      overdue++
    } else if (status === "in_progress") {
      inProgress++
    } else {
      pending++
    }
  }
  return { completed, inProgress, overdue, pending, total: completed + inProgress + overdue + pending }
}

export function ProjectAdminContent({ profiles, currentUser }: ProjectAdminContentProps) {
  const queryClient = useQueryClient()
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  // React Query fetch for project list
  const {
    data: rows = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  })

  // Health is derived from the project's own tasks on every render — nothing
  // about progress is stored, so these figures cannot drift from the tasks.
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

  // Calculate intuitive project summary statistics
  const stats = useMemo(() => {
    const total = rows.length
    const active = rows.filter((r) => r.status === "active").length
    const completed = rows.filter((r) => r.status === "completed").length

    let totalDeliveryPctSum = 0
    let projectsWithDeliveryCount = 0
    let onTrackCount = 0
    let atRiskCount = 0
    let totalOverdue = 0

    for (const p of rows) {
      const h = healthById.get(p.id)
      if (h) {
        if (h.deliveryPct !== null) {
          totalDeliveryPctSum += h.deliveryPct
          projectsWithDeliveryCount++
        }
        if (h.status === "on_track" || h.status === "completed") {
          onTrackCount++
        } else {
          atRiskCount++
        }
        totalOverdue += h.overdueCount
      }
    }

    const avgDelivery = projectsWithDeliveryCount > 0 ? Math.round(totalDeliveryPctSum / projectsWithDeliveryCount) : 0

    return {
      total,
      active,
      completed,
      avgDelivery,
      onTrackCount,
      atRiskCount,
      totalOverdue,
    }
  }, [rows, healthById])

  // Technology Types option list for filtering
  const techOptions = useMemo(() => {
    const types = Array.from(new Set(rows.map((r) => r.technology_type).filter(Boolean)))
    return types.sort().map((t) => ({ value: t!, label: t! }))
  }, [rows])

  // Table columns definition
  const columns = useMemo<DataTableColumn<Project>[]>(
    () => [
      {
        key: "project_name",
        label: "Project Title",
        sortable: true,
        accessor: (r) => r.project_name,
        render: (r) => (
          <div className="space-y-1">
            <p className="text-foreground font-semibold">{r.project_name}</p>
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
        key: "project_manager",
        label: "Project Manager",
        sortable: true,
        accessor: (r) => r.project_manager?.full_name || "",
        render: (r) => (
          <div className="flex items-center gap-1.5 text-sm">
            <Briefcase className="text-muted-foreground h-3.5 w-3.5" />
            <span>{managerName(r)}</span>
          </div>
        ),
      },
      {
        key: "portfolio",
        label: "Portfolio",
        sortable: true,
        accessor: (r) => r.portfolio?.name || "",
        render: (r) =>
          r.portfolio ? (
            <Badge variant="outline" className="text-xs">
              {r.portfolio.code || r.portfolio.name}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">Unassigned</span>
          ),
      },
      {
        key: "progress",
        label: "Delivery / Quality",
        description: PROJECT_METRIC_HELP.deliveryQuality,
        sortable: true,
        accessor: (r) => healthById.get(r.id)?.deliveryPct ?? 0,
        render: (r) => {
          const health = healthById.get(r.id)
          if (!health || health.totalWeight === 0) {
            return <span className="text-muted-foreground text-xs">No tasks</span>
          }
          return (
            <div className="w-32 space-y-1">
              <Progress value={health.deliveryPct ?? 0} className="h-1.5" />
              <p className="text-muted-foreground text-[11px]">
                {health.deliveryPct ?? 0}% delivered · {health.qualityPct ?? 0}% quality
              </p>
            </div>
          )
        },
      },
      {
        key: "status",
        label: "Status",
        description: PROJECT_METRIC_HELP.status,
        sortable: true,
        accessor: (r) => r.status,
        render: (r) => <ProjectStatusBadge status={r.status} />,
      },
    ],
    [healthById]
  )

  // Filters definition
  const filters = useMemo<DataTableFilter<Project>[]>(
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
        // The technology column moved into the expanded view, so match on the row.
        mode: "custom",
        filterFn: (row, selected) => selected.includes(row.technology_type || ""),
      },
      {
        key: "health",
        label: "Health",
        options: [
          { value: "On Track", label: "On Track" },
          { value: "At Risk", label: "At Risk" },
          { value: "Behind Schedule", label: "Behind Schedule" },
          { value: "Completed", label: "Completed" },
        ],
        mode: "custom",
        filterFn: (row, selected) =>
          selected.includes(PROJECT_HEALTH_LABELS[healthById.get(row.id)?.status ?? "on_track"]),
      },
    ],
    [techOptions, healthById]
  )

  return (
    <DataTablePage
      title="Projects Management"
      description="Overview and detailed task status tracking for all company ongoing installations."
      backLink={{ href: "/admin", label: "Back to Admin" }}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["projects"] })}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Project</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Active Projects"
            value={`${stats.active} / ${stats.total}`}
            icon={FolderKanban}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Avg Delivery Progress"
            value={`${stats.avgDelivery}%`}
            icon={TrendingUp}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            variant="compact"
            title="Schedule Health"
            value={`${stats.onTrackCount} On Track`}
            icon={ShieldCheck}
            iconBgColor={stats.atRiskCount > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"}
            iconColor={stats.atRiskCount > 0 ? "text-amber-500" : "text-emerald-500"}
          />
          <StatCard
            variant="compact"
            title="Action Items"
            value={`${stats.totalOverdue} Overdue`}
            icon={stats.totalOverdue > 0 ? AlertTriangle : CheckCircle2}
            iconBgColor={stats.totalOverdue > 0 ? "bg-red-500/10" : "bg-slate-500/10"}
            iconColor={stats.totalOverdue > 0 ? "text-red-500" : "text-slate-500"}
          />
        </StatGrid>
      }
    >
      <DataTable<Project>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(r) => r.id}
        searchPlaceholder="Search project name, location..."
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
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => r.project_name,
          subtitle: (r) => `${r.location} · ${formatCapacity(r.capacity_w)} · ${r.technology_type || "General"}`,
          trailing: (r) => <ProjectStatusBadge status={r.status} />,
          detail: {
            title: (r) => r.project_name,
            subtitle: (r) => r.location,
            badges: (r) => {
              const health = healthById.get(r.id)
              return (
                <>
                  <ProjectStatusBadge status={r.status} />
                  {health && <HealthBadge status={health.status} />}
                </>
              )
            },
            fields: (r) => {
              const health = healthById.get(r.id)
              const pct = (value: number | null | undefined) =>
                value === null || value === undefined ? null : `${value}%`
              const fields: DataTableDetailField[] = [
                { icon: MapPin, label: "Location", value: r.location },
                { icon: Briefcase, label: "Project manager", value: managerName(r) },
                { icon: Layers, label: "Portfolio", value: r.portfolio?.name ?? "Unassigned", copyable: false },
                { icon: Wrench, label: "Technology", value: r.technology_type },
                {
                  icon: FolderGit2,
                  label: "Capacity",
                  value: r.capacity_w === null ? null : formatCapacity(r.capacity_w),
                },
                {
                  icon: Calendar,
                  label: "Schedule",
                  value: `${r.deployment_start_date} → ${r.deployment_end_date}`,
                  copyable: false,
                },
                {
                  icon: Activity,
                  label: "Health",
                  value: health ? PROJECT_HEALTH_LABELS[health.status] : null,
                  copyable: false,
                },
                { label: "Delivered", value: pct(health?.deliveryPct), copyable: false },
                { label: "Quality", value: pct(health?.qualityPct), copyable: false },
                { label: "Elapsed", value: pct(health?.timeElapsedPct), copyable: false },
                {
                  label: "Variance",
                  value: formatVariance(health?.variancePct),
                  copyable: false,
                },
                { label: "Overdue tasks", value: health ? String(health.overdueCount) : null, copyable: false },
                { icon: FolderKanban, label: "Description", value: r.description, fullWidth: true },
              ]
              return fields.filter((field) => field.value)
            },
            actions: (r) => [
              {
                label: "Edit Project",
                icon: Pencil,
                onClick: () => {
                  setActiveProject(r)
                  setIsEditOpen(true)
                },
              },
            ],
          },
        }}
        cardRenderer={(r) => (
          <div className="bg-card space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{r.project_name}</p>
                <p className="text-muted-foreground text-xs">{r.location}</p>
              </div>
              <ProjectStatusBadge status={r.status} />
            </div>
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>{formatCapacity(r.capacity_w)}</span>
              <span>{r.technology_type || "General"}</span>
            </div>
            {r.portfolio && (
              <Badge variant="secondary" className="text-[10px]">
                {r.portfolio.code || r.portfolio.name}
              </Badge>
            )}
          </div>
        )}
        rowActions={[
          {
            label: "Edit Project Details",
            icon: Pencil,
            onClick: (r) => {
              setActiveProject(r)
              setIsEditOpen(true)
            },
          },
        ]}
        forceRowActionsDropdown
        expandable={{
          render: (r) => {
            const taskCounts = getProjectTaskCounts(r.tasks || [])
            return (
              <div className="bg-muted/20 space-y-3 rounded-lg border p-3">
                <ProjectSummary project={r} health={healthById.get(r.id)} />
                {taskCounts.total > 0 && (
                  <div className="bg-card space-y-1.5 rounded-lg border p-3">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-foreground font-semibold">Task Breakdown</span>
                      <span className="text-muted-foreground">
                        {taskCounts.completed} of {taskCounts.total} tasks finished
                      </span>
                    </div>
                    <ProjectStatusBar {...taskCounts} />
                  </div>
                )}
                <ProjectPlanBoard project={r} profiles={profiles} />
              </div>
            )
          },
        }}
        emptyTitle="No Projects Found"
        emptyDescription="Create a new project deployment profile to start tracking tasks."
        emptyIcon={FolderKanban}
        urlSync
      />

      <ProjectDialogs
        profiles={profiles}
        isAddOpen={isAddOpen}
        setIsAddOpen={setIsAddOpen}
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        selectedProject={activeProject}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["projects"] })
        }}
      />
    </DataTablePage>
  )
}
