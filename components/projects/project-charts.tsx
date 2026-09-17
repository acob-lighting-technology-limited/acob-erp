"use client"

import { useMemo, useState, type ReactNode } from "react"
import { format, parseISO } from "date-fns"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { BarChart3, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  buildProgressOverTime,
  buildTaskBreakdown,
  buildWeeklyFinished,
  weekStart,
  type ChartProject,
} from "@/lib/projects/charts"
import { PROJECT_HEALTH_LABELS, computeProjectHealth, plural, type ProjectHealthStatus } from "@/lib/projects/health"
import { toLocalISODate } from "@/lib/utils/date"

export type ChartsProject = ChartProject & { portfolioName: string | null }

/*
 * Colours are set per theme as CSS variables so each mode gets its own
 * validated steps (checked for colour-blind separation against each surface),
 * rather than one set of hexes flipped for dark mode.
 */
const COLOR_VARS =
  "[--chart-done:#2563eb] [--chart-progress:#14b8a6] [--chart-idle:#cbd5e1] [--chart-late:#dc2626] " +
  "[--chart-on-time:#10b981] [--chart-slipping:#f59e0b] [--chart-behind:#ef4444] [--chart-complete:#3b82f6] " +
  "dark:[--chart-done:#3b82f6] dark:[--chart-progress:#0d9488] dark:[--chart-idle:#475569] dark:[--chart-late:#ef4444] " +
  "dark:[--chart-on-time:#059669] dark:[--chart-slipping:#d97706] dark:[--chart-behind:#be123c] dark:[--chart-complete:#3b82f6]"

const STATUS_COLOR: Record<ProjectHealthStatus, string> = {
  completed: "var(--chart-complete)",
  on_track: "var(--chart-on-time)",
  at_risk: "var(--chart-slipping)",
  behind_schedule: "var(--chart-behind)",
}
const STATUS_ORDER = ["completed", "on_track", "at_risk", "behind_schedule"] as const

const TASK_SERIES = [
  { key: "done", label: "Done", color: "var(--chart-done)" },
  { key: "inProgress", label: "In progress", color: "var(--chart-progress)" },
  { key: "notStarted", label: "Not started", color: "var(--chart-idle)" },
  { key: "pastDue", label: "Past due", color: "var(--chart-late)" },
] as const

const AXIS = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const
const weekLabel = (week: string) => format(parseISO(week), "d MMM")

function truncate(text: string, max = 26) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function Legend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          {item.dashed ? (
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: item.color }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          )}
          {item.label}
        </span>
      ))}
    </div>
  )
}

type TooltipRow = { label: string; value: ReactNode; color: string; dashed?: boolean }

function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="bg-popover text-popover-foreground min-w-40 rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-semibold">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              {row.dashed ? (
                <span className="w-3 border-t-2 border-dashed" style={{ borderColor: row.color }} />
              ) : (
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: row.color }} />
              )}
              {row.label}
            </span>
            <span className="font-semibold tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A chart with a plain title, a one-line explanation, and a table view of the same numbers. */
function ChartCard({
  title,
  description,
  legend,
  notes = [],
  table,
  className,
  children,
}: {
  title: string
  description: string
  legend?: ReactNode
  notes?: string[]
  table: { columns: string[]; rows: Array<Array<string | number>> }
  className?: string
  children: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-8 shrink-0 gap-1.5 px-2 text-xs"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
        >
          {asTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {asTable ? "Chart" : "Table"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {asTable ? (
          <div className="max-h-80 overflow-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {table.columns.map((column, index) => (
                    <th key={column} className={`px-3 py-2 font-medium ${index === 0 ? "text-left" : "text-right"}`}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, index) => (
                      <td
                        key={index}
                        className={`px-3 py-1.5 ${index === 0 ? "text-left" : "text-right tabular-nums"}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {legend}
            {children}
          </>
        )}
        {notes.map((note) => (
          <p key={note} className="text-muted-foreground text-[11px]">
            {note}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed text-sm">
      {message}
    </div>
  )
}

export function ProjectCharts({
  projects,
  filterBy,
}: {
  projects: ChartsProject[]
  /**
   * What the dropdown narrows the charts to: one portfolio, or one project.
   * "none" is for a single project's own page — no dropdown, no portfolio chart.
   */
  filterBy: "portfolio" | "project" | "none"
}) {
  const [scope, setScope] = useState("all")
  const today = toLocalISODate()

  const options = useMemo(() => {
    const entries =
      filterBy === "project"
        ? projects.map((p) => ({ value: p.id, label: p.project_name }))
        : Array.from(
            new Map(projects.map((p) => [p.portfolioId ?? "none", p.portfolioName ?? "Not in a portfolio"])).entries()
          ).map(([value, label]) => ({ value, label }))
    return [
      { value: "all", label: filterBy === "project" ? "All projects" : "All portfolios" },
      ...entries.sort((a, b) => a.label.localeCompare(b.label)),
    ]
  }, [projects, filterBy])

  const selected = useMemo(() => {
    if (scope === "all") return projects
    return projects.filter((p) => (filterBy === "project" ? p.id === scope : (p.portfolioId ?? "none") === scope))
  }, [projects, scope, filterBy])

  const progress = useMemo(() => buildProgressOverTime(selected, today), [selected, today])
  const weekly = useMemo(() => buildWeeklyFinished(selected, today), [selected, today])
  const breakdown = useMemo(() => buildTaskBreakdown(selected, today), [selected, today])
  const byPortfolio = useMemo(() => {
    const groups = new Map<string, Record<ProjectHealthStatus, number> & { name: string }>()
    for (const project of selected) {
      const name = project.portfolioName ?? "Not in a portfolio"
      const group = groups.get(name) ?? { name, completed: 0, on_track: 0, at_risk: 0, behind_schedule: 0 }
      const { status } = computeProjectHealth({
        startDate: project.startDate,
        endDate: project.endDate,
        tasks: project.tasks,
        today,
      })
      group[status]++
      groups.set(name, group)
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [selected, today])

  const thisWeek = weekStart(today)
  const lastDone = [...progress.points].reverse().find((p) => p.done !== null)?.done ?? 0

  return (
    <div className={`space-y-4 ${COLOR_VARS}`}>
      {filterBy !== "none" && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect
            value={scope}
            onValueChange={(value) => setScope(value || "all")}
            options={options}
            placeholder={filterBy === "project" ? "All projects" : "All portfolios"}
            searchPlaceholder={filterBy === "project" ? "Search projects..." : "Search portfolios..."}
            className="w-full sm:w-80"
          />
          <span className="text-muted-foreground text-xs">
            {plural(selected.length, "project")} · {plural(progress.total, "task")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          className="lg:col-span-2"
          title="Will we finish on time?"
          description={`Tasks finished so far (${lastDone} of ${progress.total}), against the pace needed to finish every project by its end date.`}
          legend={
            <Legend
              items={[
                { label: "Tasks finished", color: "var(--chart-done)" },
                ...(progress.points.some((p) => p.onPace !== null)
                  ? [{ label: "On pace to finish on time", color: "var(--muted-foreground)", dashed: true }]
                  : []),
              ]}
            />
          }
          notes={[
            ...(progress.undatedDone > 0
              ? [
                  `${plural(progress.undatedDone, "task")} finished before completion dates were recorded ${progress.undatedDone === 1 ? "is" : "are"} counted from the start.`,
                ]
              : []),
            ...(progress.unscheduledProjects > 0
              ? [
                  `${plural(progress.unscheduledProjects, "project")} with no start or end date ${progress.unscheduledProjects === 1 ? "is" : "are"} left off the on-pace line.`,
                ]
              : []),
          ]}
          table={{
            columns: ["Week of", "Tasks finished", "On pace"],
            rows: progress.points.map((p) => [weekLabel(p.week), p.done ?? "—", p.onPace ?? "—"]),
          }}
        >
          {progress.total === 0 ? (
            <EmptyChart message="No tasks yet." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progress.points} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="week" tickFormatter={weekLabel} minTickGap={24} {...AXIS} />
                  <YAxis allowDecimals={false} domain={[0, progress.total]} {...AXIS} />
                  <ReferenceLine
                    x={thisWeek}
                    stroke="var(--muted-foreground)"
                    strokeOpacity={0.5}
                    label={{
                      value: "Today",
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "var(--muted-foreground)",
                    }}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--border)" }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <TooltipBox
                          title={`Week of ${weekLabel(String(label))}`}
                          rows={[
                            ...(payload[0].payload.done !== null
                              ? [{ label: "Finished", value: payload[0].payload.done, color: "var(--chart-done)" }]
                              : []),
                            ...(payload[0].payload.onPace !== null
                              ? [
                                  {
                                    label: "On pace",
                                    value: Math.round(payload[0].payload.onPace),
                                    color: "var(--muted-foreground)",
                                    dashed: true,
                                  },
                                ]
                              : []),
                          ]}
                        />
                      ) : null
                    }
                  />
                  <Line
                    dataKey="onPace"
                    stroke="var(--muted-foreground)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="done"
                    stroke="var(--chart-done)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          className={filterBy === "none" ? "lg:col-span-2" : undefined}
          title="Is the team speeding up or slowing down?"
          description="Tasks finished each week, over the last 12 weeks."
          notes={
            weekly.undated > 0
              ? [
                  `${plural(weekly.undated, "finished task")} with no completion date ${weekly.undated === 1 ? "isn't" : "aren't"} shown by week.`,
                ]
              : []
          }
          table={{
            columns: ["Week of", "Tasks finished"],
            rows: weekly.points.map((p) => [weekLabel(p.week), p.finished]),
          }}
        >
          {weekly.points.every((p) => p.finished === 0) ? (
            <EmptyChart message="No tasks finished in the last 12 weeks." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly.points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="week" tickFormatter={weekLabel} minTickGap={16} {...AXIS} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <TooltipBox
                          title={`Week of ${weekLabel(String(label))}`}
                          rows={[{ label: "Finished", value: payload[0].value as number, color: "var(--chart-done)" }]}
                        />
                      ) : null
                    }
                  />
                  <Bar
                    dataKey="finished"
                    fill="var(--chart-done)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {filterBy !== "none" && (
          <ChartCard
            title="Which portfolio is in trouble?"
            description="Projects in each portfolio, by how they are progressing."
            legend={
              <Legend
                items={STATUS_ORDER.map((status) => ({
                  label: PROJECT_HEALTH_LABELS[status],
                  color: STATUS_COLOR[status],
                }))}
              />
            }
            table={{
              columns: ["Portfolio", ...STATUS_ORDER.map((s) => PROJECT_HEALTH_LABELS[s])],
              rows: byPortfolio.map((g) => [g.name, ...STATUS_ORDER.map((s) => g[s])]),
            }}
          >
            {byPortfolio.length === 0 ? (
              <EmptyChart message="No projects yet." />
            ) : (
              <div style={{ height: Math.max(160, byPortfolio.length * 40 + 32) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byPortfolio} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" allowDecimals={false} {...AXIS} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={150}
                      tickFormatter={(v) => truncate(String(v), 22)}
                      {...AXIS}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <TooltipBox
                            title={String(label)}
                            rows={STATUS_ORDER.map((status) => ({
                              label: PROJECT_HEALTH_LABELS[status],
                              value: payload[0].payload[status],
                              color: STATUS_COLOR[status],
                            }))}
                          />
                        ) : null
                      }
                    />
                    {STATUS_ORDER.map((status) => (
                      <Bar
                        key={status}
                        dataKey={status}
                        stackId="status"
                        fill={STATUS_COLOR[status]}
                        stroke="var(--card)"
                        strokeWidth={2}
                        maxBarSize={24}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        )}

        <ChartCard
          className="lg:col-span-2"
          title="Where do each project's tasks stand?"
          description="Every task on each project today. Projects with the most past-due work are at the top."
          legend={<Legend items={TASK_SERIES.map((s) => ({ label: s.label, color: s.color }))} />}
          table={{
            columns: ["Project", ...TASK_SERIES.map((s) => s.label)],
            rows: breakdown.map((r) => [r.project_name, r.done, r.inProgress, r.notStarted, r.pastDue]),
          }}
        >
          {breakdown.length === 0 ? (
            <EmptyChart message="No tasks yet." />
          ) : (
            <div style={{ height: Math.max(160, breakdown.length * 36 + 32) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdown} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} {...AXIS} />
                  <YAxis
                    type="category"
                    dataKey="project_name"
                    width={200}
                    tickFormatter={(v) => truncate(String(v), 30)}
                    {...AXIS}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <TooltipBox
                          title={String(label)}
                          rows={TASK_SERIES.map((s) => ({
                            label: s.label,
                            value: payload[0].payload[s.key],
                            color: s.color,
                          }))}
                        />
                      ) : null
                    }
                  />
                  {TASK_SERIES.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      stackId="tasks"
                      fill={s.color}
                      stroke="var(--card)"
                      strokeWidth={2}
                      maxBarSize={20}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
