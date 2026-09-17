"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableDetailField, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
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
  AlertTriangle,
  Clock,
  LayoutDashboard,
} from "lucide-react"
import { toast } from "sonner"
import type { employee } from "@/app/admin/tasks/management/admin-tasks-content"
import { ProjectDialogs } from "./project-dialogs"
import {
  PROJECT_HEALTH_LABELS,
  PROJECT_METRIC_HELP,
  computeProjectHealth,
  formatTimeUsed,
  plural,
  type ProjectHealthTask,
} from "@/lib/projects/health"
import {
  HealthBadge,
  ProjectStatusBadge,
  ProjectSummary,
  WorkDoneCell,
  formatCapacity,
  plansText,
} from "@/components/projects/project-summary"
import { ProjectsOverview, type OverviewProject } from "@/components/projects/projects-overview"
import { toLocalISODate } from "@/lib/utils/date"
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
  plans?: { id: string }[] | null
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
          planIds: (project.plans || []).map((plan) => plan.id),
          today,
        }),
      ])
    )
  }, [rows])

  const stats = useMemo(() => {
    let needAttention = 0
    let pastDue = 0
    for (const health of healthById.values()) {
      if (health.status === "at_risk" || health.status === "behind_schedule") needAttention++
      pastDue += health.overdueCount
    }
    return { total: rows.length, needAttention, pastDue }
  }, [rows, healthById])

  // The tab lives in the URL, so a link from the Overview to "?q=<project>"
  // drops the tab and lands on the table already filtered to that project.
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeTab = searchParams.get("tab") === "overview" ? "overview" : "projects"
  const tabs = useMemo<DataTableTab[]>(
    () => [
      { key: "projects", label: "Projects", icon: FolderKanban },
      { key: "overview", label: "Overview", icon: LayoutDashboard },
    ],
    []
  )

  const overviewItems = useMemo<OverviewProject[]>(
    () =>
      rows.flatMap((project) => {
        const health = healthById.get(project.id)
        return health
          ? [
              {
                id: project.id,
                project_name: project.project_name,
                portfolioName: project.portfolio?.name ?? null,
                health,
              },
            ]
          : []
      }),
    [rows, healthById]
  )

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
        label: "Progress",
        description: PROJECT_METRIC_HELP.progress,
        sortable: true,
        accessor: (r) => healthById.get(r.id)?.workDonePct ?? -1,
        render: (r) => {
          const health = healthById.get(r.id)
          if (!health) return null
          return (
            <div className="flex items-center gap-3">
              <WorkDoneCell health={health} />
              <HealthBadge status={health.status} />
            </div>
          )
        },
      },
      {
        key: "status",
        label: "Stage",
        description: PROJECT_METRIC_HELP.stage,
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
        label: "Stage",
        options: [
          { value: "planning", label: "Planning" },
          { value: "active", label: "Ongoing" },
          { value: "on_hold", label: "On hold" },
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
        label: "Progress",
        options: (["on_track", "at_risk", "behind_schedule", "completed"] as const).map((value) => ({
          value,
          label: PROJECT_HEALTH_LABELS[value],
        })),
        mode: "custom",
        filterFn: (row, selected) => selected.includes(healthById.get(row.id)?.status ?? "on_track"),
      },
    ],
    [techOptions, healthById]
  )

  return (
    <DataTablePage
      title="Projects Management"
      description="Overview and detailed task status tracking for all company ongoing installations."
      backLink={{ href: "/admin", label: "Back to Admin" }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) =>
        router.replace(tab === "overview" ? `${pathname}?tab=overview` : pathname, { scroll: false })
      }
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
            title="Projects"
            value={stats.total}
            icon={FolderKanban}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Need attention"
            value={stats.needAttention}
            tooltip="Projects that are Slipping or Behind"
            icon={AlertTriangle}
            iconBgColor={stats.needAttention > 0 ? "bg-amber-500/10" : "bg-slate-500/10"}
            iconColor={stats.needAttention > 0 ? "text-amber-500" : "text-slate-500"}
          />
          <StatCard
            variant="compact"
            title="Tasks past due"
            value={stats.pastDue}
            tooltip={PROJECT_METRIC_HELP.pastDue}
            icon={Clock}
            iconBgColor={stats.pastDue > 0 ? "bg-red-500/10" : "bg-slate-500/10"}
            iconColor={stats.pastDue > 0 ? "text-red-500" : "text-slate-500"}
          />
        </StatGrid>
      }
    >
      {activeTab === "overview" ? (
        <ProjectsOverview
          projects={overviewItems}
          hrefFor={(p) => `${pathname}?q=${encodeURIComponent(p.project_name)}`}
        />
      ) : (
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
                    {health && <HealthBadge status={health.status} />}
                    <ProjectStatusBadge status={r.status} />
                  </>
                )
              },
              fields: (r) => {
                const health = healthById.get(r.id)
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
                    label: "Dates",
                    value: `${r.deployment_start_date} → ${r.deployment_end_date}`,
                    copyable: false,
                  },
                  {
                    icon: Activity,
                    label: "Work done",
                    value: health ? `${health.doneCount} of ${plural(health.taskCount, "task")}` : null,
                    copyable: false,
                  },
                  { label: "Time used", value: health ? formatTimeUsed(health) : null, copyable: false },
                  { label: "Plans", value: health ? plansText(health) : null, copyable: false },
                  {
                    label: "Tasks past due",
                    value: health?.overdueCount ? String(health.overdueCount) : null,
                    copyable: false,
                  },
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
            render: (r) => (
              <div className="bg-muted/20 space-y-3 rounded-lg border p-3">
                <ProjectSummary project={r} health={healthById.get(r.id)} />
                <ProjectPlanBoard project={r} profiles={profiles} />
              </div>
            ),
          }}
          emptyTitle="No Projects Found"
          emptyDescription="Create a new project deployment profile to start tracking tasks."
          emptyIcon={FolderKanban}
          urlSync
        />
      )}

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
