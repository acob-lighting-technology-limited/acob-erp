"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { toast } from "sonner"
import { FileSpreadsheet } from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ActionFormDialog } from "@/components/admin/action-tracker/action-form-dialog"
import { type ActionItem } from "@/lib/export-utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { fetchWeeklyReportLockState } from "@/lib/weekly-report-lock"
import { ActionTrackerStats } from "./_components/action-tracker-stats"
import { ActionTrackerFilters } from "./_components/action-tracker-filters"
import { ActionTrackerTable } from "./_components/action-tracker-table"
import { ActionTrackerExportButtons } from "./_components/action-tracker-export-buttons"
import { Button } from "@/components/ui/button"

import { logger } from "@/lib/logger"

const log = logger("reports-action-tracker-action-tracker-co")

interface ActionTask {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  department: string
  due_date?: string
  week_number: number
  year: number
  original_week?: number
  work_item_number?: string
}

interface ActionTrackerContentProps {
  initialDepartments: string[]
  scopedDepartments?: string[]
  editableDepartments?: string[]
  canGlobalEdit?: boolean
}

async function fetchAdminActionTrackerTasks(
  weekFilter: number,
  yearFilter: number,
  deptFilter: string,
  scopedDepartments: string[]
): Promise<ActionTask[]> {
  const params = new URLSearchParams({
    week: String(weekFilter),
    year: String(yearFilter),
    dept: deptFilter,
  })
  if (scopedDepartments.length > 0) {
    params.set("scoped_departments", scopedDepartments.join(","))
  }
  const response = await fetch(`/api/reports/action-tracker?${params.toString()}`, { cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as { data?: ActionTask[]; error?: string } | null
  if (!response.ok) throw new Error(payload?.error || "Failed to fetch action items")
  return payload?.data || []
}

export function ActionTrackerContent({
  initialDepartments,
  scopedDepartments = [],
  editableDepartments = [],
  canGlobalEdit = false,
}: ActionTrackerContentProps) {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ActionTask | null>(null)

  const [weekFilter, setWeekFilter] = useState(() => {
    const w = searchParams.get("week")
    return w ? parseInt(w) : currentOfficeWeek.week
  })
  const [yearFilter, setYearFilter] = useState(() => {
    const y = searchParams.get("year")
    return y ? parseInt(y) : currentOfficeWeek.year
  })
  const [deptFilter, setDeptFilter] = useState(() => {
    const d = searchParams.get("dept")
    return d || "all"
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isCarryForwarding, setIsCarryForwarding] = useState(false)

  const supabase = createClient()
  const canMutateTask = (task: ActionTask) => canGlobalEdit || editableDepartments.includes(task.department)

  const {
    data: tasks = [],
    isLoading: loading,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: QUERY_KEYS.adminActionTrackerTasks({ weekFilter, yearFilter, deptFilter, scopedDepartments }),
    queryFn: () => fetchAdminActionTrackerTasks(weekFilter, yearFilter, deptFilter, scopedDepartments),
  })

  const { data: lockState } = useQuery({
    queryKey: QUERY_KEYS.adminWeeklyReportLockState(weekFilter, yearFilter),
    queryFn: () => fetchWeeklyReportLockState(supabase, weekFilter, yearFilter),
  })

  const tasksQueryKey = QUERY_KEYS.adminActionTrackerTasks({ weekFilter, yearFilter, deptFilter, scopedDepartments })

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const targetTask = tasks.find((task) => task.id === taskId)
    if (targetTask && !canMutateTask(targetTask)) {
      toast.error("You can only edit actions in your departments")
      return
    }

    const previousTasks = [...tasks]
    queryClient.setQueryData(
      tasksQueryKey,
      tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    )

    try {
      const response = await fetch(`/api/reports/action-tracker/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Failed to update status")
      toast.success("Status updated")
    } catch (error) {
      log.error({ err: String(error) }, "error")
      queryClient.setQueryData(tasksQueryKey, previousTasks)
      toast.error("Failed to update status")
    }
  }

  const handleDelete = async (id: string) => {
    const targetTask = tasks.find((task) => task.id === id)
    if (targetTask && !canMutateTask(targetTask)) {
      toast.error("You can only delete actions in your departments")
      return
    }
    try {
      const response = await fetch(`/api/reports/action-tracker/${id}`, { method: "DELETE" })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Failed to delete action")
      toast.success("Action deleted")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminActionTrackerTasks() })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete"
      toast.error(message)
    }
  }

  const handleEdit = (task: ActionTask) => {
    if (!canMutateTask(task)) {
      toast.error("You can only edit actions in your departments")
      return
    }
    setEditingTask(task)
    setIsFormOpen(true)
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
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.department.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    pending: tasks.filter((t) => t.status !== "completed").length,
    notStarted: tasks.filter((t) => t.status === "not_started").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
  }

  const getDeptStatus = (dept: string) => {
    const deptActions = tasks.filter((t) => t.department === dept)
    if (deptActions.length === 0)
      return { label: "Pending", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400" }
    if (deptActions.every((a) => a.status === "completed"))
      return { label: "Finished", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" }
    if (deptActions.some((a) => a.status === "in_progress" || a.status === "completed"))
      return { label: "Started", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" }
    return { label: "Pending", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400" }
  }

  const statusColor = (status: string) => {
    if (status === "completed") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    if (status === "in_progress") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    if (status === "not_started") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
    return "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400"
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

  const handleCarryForward = async () => {
    setIsCarryForwarding(true)
    try {
      const response = await fetch("/api/reports/action-tracker/carry-forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_number: weekFilter, year: yearFilter }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string; carried_count?: number } | null
      if (!response.ok) throw new Error(payload?.error || "Failed to carry forward items")
      toast.success(`Carried forward ${payload?.carried_count || 0} items`)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminActionTrackerTasks() })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to carry forward items")
    } finally {
      setIsCarryForwarding(false)
    }
  }

  return (
    <AdminTablePage
      title="Action Tracker"
      description="Monitor and manage weekly departmental actions"
      icon={FileSpreadsheet}
      backLinkHref="/admin/reports/general-meeting"
      backLinkLabel="Back to General Meeting"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCarryForward} disabled={isCarryForwarding}>
            Carry Forward
          </Button>
          {tasks.length > 0 ? (
            <ActionTrackerExportButtons
              items={actionItemsForExport}
              weekFilter={weekFilter}
              yearFilter={yearFilter}
              meetingDate={lockState?.meetingDate}
            />
          ) : null}
        </div>
      }
      stats={
        <ActionTrackerStats
          total={stats.total}
          completed={stats.completed}
          pending={stats.pending}
          notStarted={stats.notStarted}
          inProgress={stats.inProgress}
        />
      }
      filters={
        <ActionTrackerFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          weekFilter={weekFilter}
          onWeekChange={setWeekFilter}
          yearFilter={yearFilter}
          onYearChange={setYearFilter}
          deptFilter={deptFilter}
          onDeptChange={setDeptFilter}
          departments={initialDepartments}
          loading={loading}
          onRefresh={() => refetchTasks()}
        />
      }
    >
      <ActionTrackerTable
        tasks={filteredTasks}
        loading={loading}
        expandedDepts={expandedDepts}
        onToggleDept={toggleDept}
        weekFilter={weekFilter}
        yearFilter={yearFilter}
        meetingDate={lockState?.meetingDate}
        canMutateTask={canMutateTask}
        onStatusChange={handleStatusChange}
        onEdit={handleEdit}
        onDeleteRequest={setPendingDeleteId}
        getDeptStatus={getDeptStatus}
        statusColor={statusColor}
      />

      <ActionFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onComplete={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminActionTrackerTasks() })}
        departments={canGlobalEdit ? initialDepartments : editableDepartments}
        editingAction={editingTask}
        defaultWeek={weekFilter}
        defaultYear={yearFilter}
      />

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this action? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) handleDelete(pendingDeleteId)
                setPendingDeleteId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminTablePage>
  )
}
