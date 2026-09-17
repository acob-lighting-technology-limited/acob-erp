"use client"

import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableDetailField, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import {
  FolderGit2,
  FolderKanban,
  RefreshCw,
  Calendar,
  MapPin,
  Wrench,
  Briefcase,
  Activity,
  Layers,
  AlertTriangle,
  Clock,
  LayoutDashboard,
} from "lucide-react"
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
  WorkDoneText,
  formatCapacity,
  plansText,
} from "@/components/projects/project-summary"
import { ProjectsOverview, type OverviewProject } from "@/components/projects/projects-overview"
import { toLocalISODate } from "@/lib/utils/date"
import { ProjectPlanBoard } from "@/app/admin/project/_components/project-plan-board"
import type { employee } from "@/app/admin/tasks/management/admin-tasks-content"

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
  plans?: { id: string }[] | null
}

export interface ProjectContentProps {
  profiles?: employee[]
  currentUser?: {
    id: string
    role: string
    is_department_lead: boolean
    department: string | null
    canManage?: boolean
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

export function ProjectContent({ profiles = [] }: ProjectContentProps = {}) {
  const queryClient = useQueryClient()
  const staffAvatars = useStaffAvatars()

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

  // Progress comes from the same helper the admin project and portfolio pages
  // use, so a project reads the same whichever page you open it on.
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
  const columns = useMemo<DataTableColumn<ProjectRow>[]>(
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
            {r.project_manager ? (
              <StaffAvatar
                name={
                  r.project_manager.full_name || [r.project_manager.first_name, r.project_manager.last_name].join(" ")
                }
                src={staffAvatars[r.project_manager.id]}
                size="xs"
              />
            ) : (
              <Briefcase className="text-muted-foreground h-3.5 w-3.5" />
            )}
            <span>
              {r.project_manager?.full_name ||
                [r.project_manager?.first_name, r.project_manager?.last_name].filter(Boolean).join(" ") ||
                "Unassigned"}
            </span>
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
    [healthById, staffAvatars]
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
        mode: "custom",
        filterFn: (row, selected) => selected.includes(row.technology_type || ""),
      },
      {
        key: "health",
        label: "Progress",
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
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) =>
        router.replace(tab === "overview" ? `${pathname}?tab=overview` : pathname, { scroll: false })
      }
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
            title="My projects"
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
            trailing: (r) => <ProjectStatusBadge status={r.status} />,
            detail: {
              title: (r) => r.project_name,
              subtitle: (r) => <span className="text-muted-foreground text-xs">{r.location}</span>,
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
            },
          }}
          cardRenderer={(r) => {
            const health = healthById.get(r.id)
            return (
              <div className="group bg-card text-card-foreground border-border/60 hover:border-primary/40 h-full space-y-3 rounded-xl border p-4 shadow-sm transition-all">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="line-clamp-2 text-sm font-semibold">{r.project_name}</h4>
                  <ProjectStatusBadge status={r.status} />
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
                </div>
                {health && (
                  <p className="text-muted-foreground text-xs">
                    <WorkDoneText health={health} />
                  </p>
                )}
                <div className="border-border/40 text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
                  <span>
                    {r.project_manager?.full_name ||
                      [r.project_manager?.first_name, r.project_manager?.last_name].filter(Boolean).join(" ") ||
                      "Unassigned"}
                  </span>
                  {health && <HealthBadge status={health.status} />}
                </div>
              </div>
            )
          }}
          expandable={{
            render: (r) => (
              <div className="bg-muted/20 space-y-3 rounded-lg border p-3">
                <ProjectSummary project={r} health={healthById.get(r.id)} />
                <ProjectPlanBoard project={r as any} profiles={profiles} readOnly={true} />
              </div>
            ),
          }}
          emptyTitle="No Projects Assigned"
          emptyDescription="You will see projects here once you are assigned as a manager or member."
          emptyIcon={FolderKanban}
          urlSync
        />
      )}
    </DataTablePage>
  )
}
