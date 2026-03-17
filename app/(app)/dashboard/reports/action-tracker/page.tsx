"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { toast } from "sonner"
import { FileSpreadsheet, CheckCircle2, Clock, RefreshCw } from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { type ActionItem } from "@/lib/export-utils"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"
import { TableSkeleton } from "@/components/ui/query-states"
import { QUERY_KEYS } from "@/lib/query-keys"
import { logger } from "@/lib/logger"
import { ActionTrackerFilters } from "./_components/action-tracker-filters"
import { ActionTrackerExportButtons } from "./_components/action-tracker-export-buttons"
import { DeptActionRows } from "./_components/dept-action-rows"
import { fetchActionTrackerMetadata, fetchActionTrackerTasks, getDeptStatus, getStatusColor } from "./_lib/queries"

const log = logger("dashboard-reports-action-tracker")

export default function ActionTrackerPortal() {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [week, setWeek] = useState(() => {
    const w = searchParams.get("week")
    return w ? parseInt(w) : currentOfficeWeek.week
  })
  const [year, setYear] = useState(() => {
    const y = searchParams.get("year")
    return y ? parseInt(y) : currentOfficeWeek.year
  })
  const [deptFilter, setDeptFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const { data: metaData } = useQuery({
    queryKey: QUERY_KEYS.actionTrackerMetadata(),
    queryFn: () => fetchActionTrackerMetadata(supabase),
  })

  const profile = metaData?.profile ?? null
  const allDepartments = metaData?.allDepartments ?? []

  const {
    data: tasksData,
    isLoading: loading,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: QUERY_KEYS.actionTrackerTasks({ week, year, deptFilter }),
    queryFn: () => fetchActionTrackerTasks(supabase, week, year, deptFilter),
  })

  const tasks = tasksData?.tasks ?? []

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    if (profile?.department !== task.department) {
      toast.error("Unauthorized: You can only update statuses for your own department")
      return
    }
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", taskId)
      if (error) throw error
      toast.success("Status updated")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.actionTrackerTasks({ week, year, deptFilter }) })
    } catch (error) {
      log.error({ err: String(error) }, "error")
      toast.error("Failed to update status")
    }
  }

  const toggleDept = (dept: string) => {
    const next = new Set(expandedDepts)
    if (next.has(dept)) next.delete(dept)
    else next.add(dept)
    setExpandedDepts(next)
  }

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.department.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const deptsPresent = Array.from(new Set(filteredTasks.map((t) => t.department))).sort()

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    pending: tasks.filter((t) => t.status !== "completed").length,
    notStarted: tasks.filter((t) => t.status === "not_started").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
  }

  const actionItemsForExport: ActionItem[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    department: t.department,
    status: t.status,
    week_number: t.week_number,
    year: t.year,
  }))

  return (
    <AdminTablePage
      title="Action Tracker"
      description="Track departmental items and progress for the current week"
      icon={FileSpreadsheet}
      backLinkHref="/dashboard/reports"
      backLinkLabel="Back to Reports"
      actions={
        tasks.length > 0 ? (
          <ActionTrackerExportButtons actionItems={actionItemsForExport} week={week} year={year} />
        ) : null
      }
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-5 md:gap-4">
          <StatCard title="Total Actions" value={stats.total} icon={FileSpreadsheet} />
          <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} />
          <StatCard title="Pending" value={stats.pending} icon={Clock} />
          <StatCard title="Not Started" value={stats.notStarted} icon={Clock} />
          <StatCard title="In Progress" value={stats.inProgress} icon={RefreshCw} />
        </div>
      }
      filters={
        <ActionTrackerFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          week={week}
          onWeekChange={setWeek}
          year={year}
          onYearChange={setYear}
          deptFilter={deptFilter}
          onDeptFilterChange={setDeptFilter}
          allDepartments={allDepartments}
          loading={loading}
          onRefresh={() => refetchTasks()}
        />
      }
    >
      <div className="bg-background dark:bg-card overflow-hidden rounded-lg border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="font-bold">Department</TableHead>
              <TableHead className="font-bold">Summary</TableHead>
              <TableHead className="text-center font-bold">Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="p-4">
                  <TableSkeleton rows={4} cols={4} />
                </TableCell>
              </TableRow>
            ) : deptsPresent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32">
                  <EmptyState
                    title="No actions found"
                    description="No departmental actions match the selected filters."
                    icon={FileSpreadsheet}
                    className="border-0"
                  />
                </TableCell>
              </TableRow>
            ) : (
              <DeptActionRows
                deptsPresent={deptsPresent}
                filteredTasks={filteredTasks}
                expandedDepts={expandedDepts}
                onToggleDept={toggleDept}
                profile={profile}
                week={week}
                year={year}
                onStatusChange={handleStatusChange}
                getDeptStatus={(dept) => getDeptStatus(tasks, dept)}
                statusColor={getStatusColor}
              />
            )}
          </TableBody>
        </Table>
      </div>
    </AdminTablePage>
  )
}
