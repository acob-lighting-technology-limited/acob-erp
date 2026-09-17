"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  Clock,
  ArrowRight,
  FolderCog,
  FolderKanban,
  BarChart3,
  LayoutDashboard,
  Layers,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  PROJECT_HEALTH_LABELS,
  PROJECT_METRIC_HELP,
  plural,
  type PortfolioHealth,
  type ProjectHealth,
} from "@/lib/projects/health"
import {
  HealthBadge,
  PortfolioStatusBadge,
  WorkDoneCell,
  WorkDoneText,
  plansText,
} from "@/components/projects/project-summary"
import { ProjectDialogs } from "@/app/admin/project/_components/project-dialogs"
import { DeletePortfolioDialog } from "./delete-portfolio-dialog"
import { PortfolioDialog } from "./portfolio-dialog"
import { PortfolioProjectsDialog } from "./portfolio-projects-dialog"
import { PortfolioOverview } from "./portfolio-overview"
import { ProjectCharts, type ChartsProject } from "@/components/projects/project-charts"
import type { ProjectHealthTask } from "@/lib/projects/health"
import { portfolioHref, projectHref } from "@/lib/projects/links"
import { useRouter } from "next/navigation"

export type ProjectHealthRow = ProjectHealth & {
  id: string
  project_name: string
  lifecycle_status: string | null
}

export type Portfolio = {
  id: string
  name: string
  code: string | null
  description: string | null
  status: "active" | "on_hold" | "closed"
  projects: ProjectHealthRow[]
  rollup: PortfolioHealth
}

/**
 * The projects shown when a portfolio row is expanded — a short list that
 * links to each project's own page, where its plans are managed.
 */
function PortfolioProjects({
  portfolioId,
  projects,
  isAdmin,
  onManage,
  onAddProject,
}: {
  portfolioId: string
  projects: ProjectHealthRow[]
  isAdmin: boolean
  onManage?: () => void
  onAddProject?: () => void
}) {
  return (
    <div className="space-y-3 p-2">
      {projects.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm">
          No projects in this portfolio yet.
        </p>
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={projectHref(project.id, isAdmin)}
                className="group hover:bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{project.project_name}</span>
                <HealthBadge status={project.status} />
                <span className="text-muted-foreground text-xs">
                  <WorkDoneText health={project} />
                </span>
                {plansText(project) && <span className="text-muted-foreground text-xs">{plansText(project)}</span>}
                <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={portfolioHref(portfolioId, isAdmin)}>
            Open portfolio
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        {(onManage || onAddProject) && (
          <div className="flex flex-wrap items-center gap-2">
            {onManage && (
              <Button type="button" variant="outline" size="sm" onClick={onManage}>
                <FolderCog className="mr-2 h-4 w-4" />
                Manage Projects
              </Button>
            )}
            {onAddProject && (
              <Button type="button" size="sm" onClick={onAddProject}>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

type ProjectManagerOption = {
  id: string
  first_name: string
  last_name: string
  full_name?: string | null
  department: string
}

interface PortfoliosContentProps {
  isAdmin?: boolean
  /** Project manager options for creating a project inside a portfolio. */
  profiles?: ProjectManagerOption[]
}

export function PortfoliosContent({ isAdmin = true, profiles = [] }: PortfoliosContentProps = {}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>("portfolios")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<Portfolio | null>(null)
  const [deleting, setDeleting] = useState<Portfolio | null>(null)
  const [managingId, setManagingId] = useState<string | null>(null)
  const [createInPortfolioId, setCreateInPortfolioId] = useState<string | null>(null)

  const tabs = useMemo<DataTableTab[]>(
    () => [
      { key: "portfolios", label: "Portfolios", icon: Layers },
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "charts", label: "Charts", icon: BarChart3 },
    ],
    []
  )

  const { data, isLoading, error, refetch } = useQuery<{
    data: Portfolio[]
    unassigned: { projects: ProjectHealthRow[]; rollup: PortfolioHealth }
  }>({
    queryKey: ["portfolios"],
    queryFn: async () => {
      const res = await apiFetch("/api/portfolios", { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load portfolios")
      return payload
    },
  })

  const rows = useMemo(() => data?.data ?? [], [data])

  // The charts need each task's dates, which the portfolio rollup leaves out, so
  // they read the projects list — only once the Charts tab is opened.
  const { data: chartProjects = [], isLoading: chartsLoading } = useQuery({
    queryKey: ["projects", "charts"],
    enabled: activeTab === "charts",
    queryFn: async (): Promise<ChartsProject[]> => {
      const res = await apiFetch("/api/projects", { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load projects")
      return (
        (payload.data || []) as Array<{
          id: string
          project_name: string
          deployment_start_date: string | null
          deployment_end_date: string | null
          portfolio?: { id: string; name: string } | null
          tasks?: ProjectHealthTask[] | null
        }>
      ).map((project) => ({
        id: project.id,
        project_name: project.project_name,
        portfolioId: project.portfolio?.id ?? null,
        portfolioName: project.portfolio?.name ?? null,
        startDate: project.deployment_start_date,
        endDate: project.deployment_end_date,
        tasks: project.tasks || [],
      }))
    },
  })
  // Read from the live rows so the dialog reflects each add/remove once refetched.
  const managing = useMemo(() => rows.find((row) => row.id === managingId) ?? null, [rows, managingId])
  const refreshPortfolios = () => queryClient.invalidateQueries({ queryKey: ["portfolios"] })

  // Counted across unassigned projects too, so the numbers match the Overview tab.
  const stats = useMemo(() => {
    const rollups = [...rows.map((row) => row.rollup), ...(data?.unassigned ? [data.unassigned.rollup] : [])]
    return {
      projectCount: rollups.reduce((sum, r) => sum + r.projectCount, 0),
      needAttention: rollups.reduce((sum, r) => sum + r.atRisk + r.behindSchedule, 0),
      pastDue: rollups.reduce((sum, r) => sum + r.overdueCount, 0),
    }
  }, [rows, data])

  const columns = useMemo<DataTableColumn<Portfolio>[]>(
    () => [
      {
        key: "name",
        label: "Portfolio",
        sortable: true,
        accessor: (r) => r.name,
        render: (r) => (
          <div className="space-y-1">
            <Link
              href={portfolioHref(r.id, isAdmin)}
              onClick={(e) => e.stopPropagation()}
              className="text-foreground hover:text-primary font-semibold hover:underline"
            >
              {r.code ? `${r.code} — ${r.name}` : r.name}
            </Link>
            {r.description && <p className="text-muted-foreground line-clamp-1 text-xs">{r.description}</p>}
          </div>
        ),
      },
      {
        key: "projects",
        label: "Projects",
        description: PROJECT_METRIC_HELP.portfolioProjects,
        sortable: true,
        accessor: (r) => r.rollup.projectCount,
        render: (r) => (
          <div className="text-xs">
            <p className="text-foreground font-medium">
              {r.rollup.completed} of {plural(r.rollup.projectCount, "project")} done
            </p>
            <p className="text-muted-foreground">
              {[
                r.rollup.onTrack && `${r.rollup.onTrack} on time`,
                r.rollup.atRisk && `${r.rollup.atRisk} slipping`,
                r.rollup.behindSchedule && `${r.rollup.behindSchedule} behind`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        ),
      },
      {
        key: "progress",
        label: "Work done",
        description: PROJECT_METRIC_HELP.workDone,
        sortable: true,
        accessor: (r) => r.rollup.workDonePct ?? -1,
        render: (r) => <WorkDoneCell health={r.rollup} />,
      },
      {
        key: "overdue",
        label: "Tasks past due",
        description: PROJECT_METRIC_HELP.pastDue,
        sortable: true,
        accessor: (r) => r.rollup.overdueCount,
        render: (r) =>
          r.rollup.overdueCount > 0 ? (
            <Badge className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400">
              {r.rollup.overdueCount}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">None</span>
          ),
      },
      {
        key: "status",
        label: "Status",
        description: PROJECT_METRIC_HELP.portfolioStatus,
        sortable: true,
        accessor: (r) => r.status,
        render: (r) => <PortfolioStatusBadge status={r.status} />,
      },
    ],
    [isAdmin]
  )

  const filters = useMemo<DataTableFilter<Portfolio>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        options: [
          { value: "active", label: "Active" },
          { value: "on_hold", label: "On hold" },
          { value: "closed", label: "Closed" },
        ],
      },
      {
        key: "health",
        label: "Contains",
        options: [
          { value: "at_risk", label: PROJECT_HEALTH_LABELS.at_risk },
          { value: "behind_schedule", label: PROJECT_HEALTH_LABELS.behind_schedule },
          { value: "overdue", label: "Tasks past due" },
        ],
        mode: "custom",
        filterFn: (row, selected) =>
          selected.some((value) =>
            value === "overdue" ? row.rollup.overdueCount > 0 : row.projects.some((project) => project.status === value)
          ),
      },
    ],
    []
  )

  return (
    <DataTablePage
      title="Project Portfolios"
      description="Groups of related projects. Progress is counted from each project's tasks."
      icon={Layers}
      backLink={isAdmin ? { href: "/admin", label: "Back to Admin" } : { href: "/projects", label: "Back to Projects" }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["portfolios"] })}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Portfolio</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
        </div>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Projects"
            value={stats.projectCount}
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
      {activeTab === "charts" ? (
        chartsLoading ? (
          <div className="bg-muted/40 h-64 animate-pulse rounded-xl" />
        ) : (
          <ProjectCharts projects={chartProjects} filterBy="portfolio" />
        )
      ) : activeTab === "overview" ? (
        <PortfolioOverview rows={rows} unassigned={data?.unassigned} isAdmin={isAdmin} />
      ) : (
        <DataTable<Portfolio>
          data={rows}
          columns={columns}
          filters={filters}
          getRowId={(r) => r.id}
          searchPlaceholder="Search portfolio name or code..."
          searchFn={(row, query) => {
            const q = query.toLowerCase()
            return (
              row.name.toLowerCase().includes(q) ||
              (row.code || "").toLowerCase().includes(q) ||
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
            title: (r) => (r.code ? `${r.code} — ${r.name}` : r.name),
            subtitle: (r) =>
              `${plural(r.rollup.projectCount, "project")} · ${r.rollup.doneCount} of ${plural(r.rollup.taskCount, "task")} done`,
            trailing: (r) => <PortfolioStatusBadge status={r.status} />,
            onSelect: isAdmin ? (r) => setEditing(r) : undefined,
          }}
          cardRenderer={(r) => (
            <div className="bg-card space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{r.code ? `${r.code} — ${r.name}` : r.name}</p>
                  {r.description && <p className="text-muted-foreground line-clamp-1 text-xs">{r.description}</p>}
                </div>
                <PortfolioStatusBadge status={r.status} />
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-xs">
                <span className="text-muted-foreground">{plural(r.rollup.projectCount, "project")}</span>
                <span className="text-muted-foreground">
                  {r.rollup.doneCount} of {plural(r.rollup.taskCount, "task")} done
                </span>
              </div>
            </div>
          )}
          rowActions={[
            {
              label: "Open portfolio",
              icon: ArrowRight,
              onClick: (r: Portfolio) => router.push(portfolioHref(r.id, isAdmin)),
            },
            ...(isAdmin
              ? [
                  { label: "Manage Projects", icon: FolderCog, onClick: (r: Portfolio) => setManagingId(r.id) },
                  { label: "New Project", icon: Plus, onClick: (r: Portfolio) => setCreateInPortfolioId(r.id) },
                  { label: "Edit Portfolio", onClick: (r: Portfolio) => setEditing(r) },
                  {
                    label: "Delete Portfolio",
                    icon: Trash2,
                    variant: "destructive" as const,
                    onClick: (r: Portfolio) => setDeleting(r),
                  },
                ]
              : []),
          ]}
          expandable={{
            render: (r) => (
              <div className="bg-muted/20 rounded-lg border p-2">
                <PortfolioProjects
                  portfolioId={r.id}
                  projects={r.projects}
                  isAdmin={isAdmin}
                  onManage={isAdmin ? () => setManagingId(r.id) : undefined}
                  onAddProject={isAdmin ? () => setCreateInPortfolioId(r.id) : undefined}
                />
              </div>
            ),
          }}
          emptyTitle="No Portfolios Yet"
          emptyDescription="Create a portfolio to group related projects under one programme or client."
          emptyIcon={Layers}
          urlSync
        />
      )}

      <PortfolioDialog
        open={isAddOpen || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false)
            setEditing(null)
          }
        }}
        portfolio={editing}
        onDelete={(portfolio) => {
          setEditing(null)
          setDeleting(portfolio)
        }}
        onSuccess={() => {
          toast.success(editing ? "Portfolio updated" : "Portfolio created")
          setIsAddOpen(false)
          setEditing(null)
          void refreshPortfolios()
        }}
      />

      {isAdmin && (
        <>
          <DeletePortfolioDialog
            portfolio={deleting}
            onOpenChange={(open) => {
              if (!open) setDeleting(null)
            }}
            onDeleted={() => {
              setDeleting(null)
              void refreshPortfolios()
            }}
            onManageProjects={(portfolio) => {
              setDeleting(null)
              setManagingId(portfolio.id)
            }}
          />

          <PortfolioProjectsDialog
            open={managing !== null}
            onOpenChange={(open) => {
              if (!open) setManagingId(null)
            }}
            portfolio={managing}
            portfolios={rows}
            unassignedProjects={data?.unassigned?.projects ?? []}
            onChanged={refreshPortfolios}
            onCreateProject={() => {
              // Swap rather than stack: two modals would fight over focus.
              setCreateInPortfolioId(managingId)
              setManagingId(null)
            }}
          />

          <ProjectDialogs
            profiles={profiles}
            isAddOpen={createInPortfolioId !== null}
            setIsAddOpen={(open) => {
              if (!open) setCreateInPortfolioId(null)
            }}
            isEditOpen={false}
            setIsEditOpen={() => {}}
            selectedProject={null}
            defaultPortfolioId={createInPortfolioId}
            onSuccess={() => void refreshPortfolios()}
          />
        </>
      )}
    </DataTablePage>
  )
}
