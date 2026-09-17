"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderCog,
  FolderGit2,
  FolderKanban,
  Layers,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ColumnHelp, DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { Progress } from "@/components/ui/progress"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { PROJECT_HEALTH_LABELS, PROJECT_METRIC_HELP, type ProjectHealthStatus } from "@/lib/projects/health"
import { HealthBadge, PortfolioStatusBadge, ProjectStatusBadge } from "@/components/projects/project-summary"
import { ProjectDialogs } from "@/app/admin/project/_components/project-dialogs"
import { ProjectPlanBoard } from "@/app/admin/project/_components/project-plan-board"
import { DeletePortfolioDialog } from "./delete-portfolio-dialog"
import { PortfolioDialog } from "./portfolio-dialog"
import { PortfolioProjectsDialog } from "./portfolio-projects-dialog"
import { PortfolioAnalytics } from "./portfolio-analytics"
import { projectHref } from "./project-href"

export type ProjectHealthRow = {
  id: string
  project_name: string
  lifecycle_status: string | null
  deliveryPct: number | null
  qualityPct: number | null
  timeElapsedPct: number | null
  variancePct: number | null
  status: ProjectHealthStatus
  overdueCount: number
  totalWeight: number
  taskCount: number
  totalPlans?: number
  completedPlans?: number
  planProgressPct?: number | null
}

type PortfolioRollup = {
  projectCount: number
  onTrack: number
  atRisk: number
  behindSchedule: number
  completed: number
  overdueCount: number
  deliveryPct: number | null
  qualityPct: number | null
  totalPlans?: number
  completedPlans?: number
  planProgressPct?: number | null
}

export type Portfolio = {
  id: string
  name: string
  code: string | null
  description: string | null
  status: "active" | "on_hold" | "closed"
  projects: ProjectHealthRow[]
  rollup: PortfolioRollup
}

/** The implementation plans and project boards shown when a portfolio is expanded. */
function PortfolioProjects({
  projects,
  isAdmin,
  profiles = [],
  onManage,
  onAddProject,
}: {
  projects: ProjectHealthRow[]
  isAdmin: boolean
  profiles?: ProjectManagerOption[]
  onManage?: () => void
  onAddProject?: () => void
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || "")

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0] || null

  const actions =
    onManage || onAddProject ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
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
    ) : null

  if (projects.length === 0) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm">
          No projects in this portfolio yet.
        </p>
        {actions}
      </div>
    )
  }

  return (
    <div className="space-y-4 p-2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 1 ? (
            <div className="bg-muted/60 flex flex-wrap items-center gap-1.5 rounded-lg p-1">
              {projects.map((p) => {
                const isActive = p.id === activeProject?.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProjectId(p.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                      isActive
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{p.project_name}</span>
                    {p.totalPlans !== undefined && p.totalPlans > 0 && (
                      <Badge variant="outline" className="px-1 py-0 text-[10px]">
                        {p.completedPlans ?? 0}/{p.totalPlans} plans
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          ) : activeProject ? (
            <div className="flex items-center gap-2">
              <span className="text-foreground text-sm font-semibold">{activeProject.project_name}</span>
              <HealthBadge status={activeProject.status} />
              {activeProject.planProgressPct !== null && (
                <Badge variant="outline" className="text-xs">
                  {activeProject.planProgressPct}% Plan Progress
                </Badge>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {activeProject && (
            <Link
              href={projectHref(activeProject.project_name, isAdmin)}
              className="text-primary mr-1 inline-flex items-center gap-1 text-xs hover:underline"
            >
              Open project workspace <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          {actions}
        </div>
      </div>

      {activeProject && (
        <div className="bg-card space-y-4 rounded-xl border p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-foreground text-base font-semibold">{activeProject.project_name}</h4>
                <HealthBadge status={activeProject.status} />
                {activeProject.planProgressPct !== null && (
                  <Badge variant="secondary" className="text-xs">
                    {activeProject.planProgressPct}% Progress
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {activeProject.taskCount} task{activeProject.taskCount === 1 ? "" : "s"}
                {activeProject.totalPlans !== undefined &&
                  ` · ${activeProject.completedPlans ?? 0}/${activeProject.totalPlans} implementation plans completed`}
              </p>
            </div>
          </div>

          <ProjectPlanBoard
            project={{
              id: activeProject.id,
              project_name: activeProject.project_name,
              location: "",
              deployment_start_date: "",
              deployment_end_date: "",
              capacity_w: null,
              technology_type: null,
              project_manager_id: null,
              description: null,
              status: (activeProject.lifecycle_status as any) || "active",
              created_at: "",
              updated_at: "",
              portfolio_id: null,
            }}
            profiles={profiles}
            readOnly={!isAdmin}
          />
        </div>
      )}
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
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>("portfolios")
  const [focusedPortfolioId, setFocusedPortfolioId] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<Portfolio | null>(null)
  const [deleting, setDeleting] = useState<Portfolio | null>(null)
  const [managingId, setManagingId] = useState<string | null>(null)
  const [createInPortfolioId, setCreateInPortfolioId] = useState<string | null>(null)

  const tabs = useMemo<DataTableTab[]>(
    () => [
      { key: "portfolios", label: "Portfolios", icon: Layers },
      { key: "analytics", label: "Analytics", icon: BarChart3 },
    ],
    []
  )

  const { data, isLoading, error, refetch } = useQuery<{
    data: Portfolio[]
    unassigned: { projects: ProjectHealthRow[]; rollup: PortfolioRollup }
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
  // Read from the live rows so the dialog reflects each add/remove once refetched.
  const managing = useMemo(() => rows.find((row) => row.id === managingId) ?? null, [rows, managingId])
  const refreshPortfolios = () => queryClient.invalidateQueries({ queryKey: ["portfolios"] })

  const stats = useMemo(() => {
    const projectCount = rows.reduce((sum, row) => sum + row.rollup.projectCount, 0)
    const atRisk = rows.reduce((sum, row) => sum + row.rollup.atRisk + row.rollup.behindSchedule, 0)
    const overdue = rows.reduce((sum, row) => sum + row.rollup.overdueCount, 0)
    return { portfolios: rows.length, projectCount, atRisk, overdue }
  }, [rows])

  const columns = useMemo<DataTableColumn<Portfolio>[]>(
    () => [
      {
        key: "name",
        label: "Portfolio",
        sortable: true,
        accessor: (r) => r.name,
        render: (r) => (
          <div className="space-y-1">
            <p className="text-foreground font-semibold">{r.code ? `${r.code} — ${r.name}` : r.name}</p>
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
            <p className="text-foreground font-medium">{r.rollup.projectCount} total</p>
            <p className="text-muted-foreground">
              {r.rollup.onTrack} on track · {r.rollup.atRisk} at risk · {r.rollup.behindSchedule} behind
            </p>
          </div>
        ),
      },
      {
        key: "progress",
        label: "Plan Progress",
        description: PROJECT_METRIC_HELP.portfolioProgress,
        sortable: true,
        accessor: (r) => r.rollup.planProgressPct ?? 0,
        render: (r) =>
          r.rollup.planProgressPct === null ? (
            <span className="text-muted-foreground text-xs">No plans</span>
          ) : (
            <div className="w-36 space-y-1">
              <Progress value={r.rollup.planProgressPct} className="h-1.5" />
              <p className="text-muted-foreground text-[11px]">
                <span className="text-foreground font-semibold">{r.rollup.planProgressPct}% progress</span>
                {Boolean(r.rollup.totalPlans && r.rollup.totalPlans > 0) && (
                  <span>
                    {" "}
                    · {r.rollup.completedPlans}/{r.rollup.totalPlans} plans
                  </span>
                )}
              </p>
            </div>
          ),
      },
      {
        key: "overdue",
        label: "Overdue Tasks",
        description: PROJECT_METRIC_HELP.overdue,
        sortable: true,
        accessor: (r) => r.rollup.overdueCount,
        render: (r) =>
          r.rollup.overdueCount > 0 ? (
            <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-500">{r.rollup.overdueCount}</Badge>
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
    []
  )

  const filters = useMemo<DataTableFilter<Portfolio>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        options: [
          { value: "active", label: "Active" },
          { value: "on_hold", label: "On Hold" },
          { value: "closed", label: "Closed" },
        ],
      },
      {
        key: "health",
        label: "Contains",
        options: [
          { value: "at_risk", label: PROJECT_HEALTH_LABELS.at_risk },
          { value: "behind_schedule", label: PROJECT_HEALTH_LABELS.behind_schedule },
          { value: "overdue", label: "Overdue tasks" },
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
      description="Programmes and client groupings, each holding its own projects. Progress is derived from project tasks."
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
            title="Portfolios"
            value={stats.portfolios}
            icon={Layers}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
          />
          <StatCard
            variant="compact"
            title="At Risk / Behind"
            value={stats.atRisk}
            icon={AlertTriangle}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            variant="compact"
            title="Overdue Tasks"
            value={stats.overdue}
            icon={FolderGit2}
            iconBgColor="bg-red-500/10"
            iconColor="text-red-500"
          />
          <StatCard
            variant="compact"
            title="Projects"
            value={stats.projectCount}
            icon={FolderKanban}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
        </StatGrid>
      }
    >
      {activeTab === "analytics" ? (
        <PortfolioAnalytics
          rows={rows}
          unassigned={data?.unassigned?.rollup}
          isAdmin={isAdmin}
          focusedPortfolioId={focusedPortfolioId}
          onFocusPortfolio={setFocusedPortfolioId}
        />
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
              `${r.rollup.projectCount} projects · ${r.rollup.planProgressPct ?? 0}% progress · ${r.rollup.overdueCount} overdue`,
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
                <span className="text-muted-foreground">{r.rollup.projectCount} projects</span>
                <span className="text-muted-foreground">{r.rollup.planProgressPct ?? 0}% progress</span>
              </div>
            </div>
          )}
          rowActions={[
            {
              label: "View Analytics",
              icon: BarChart3,
              onClick: (r) => {
                setFocusedPortfolioId(r.id)
                setActiveTab("analytics")
              },
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
                  projects={r.projects}
                  isAdmin={isAdmin}
                  profiles={profiles}
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
