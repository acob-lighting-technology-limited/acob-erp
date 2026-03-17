"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import { ActionTrackerStats } from "./_components/action-tracker-stats"
import { ActionTrackerFilters } from "./_components/action-tracker-filters"
import { ActionTrackerTable } from "./_components/action-tracker-table"
import { ActionTrackerExportButtons } from "./_components/action-tracker-export-buttons"

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
  supabase: ReturnType<typeof createClient>,
  weekFilter: number,
  yearFilter: number,
  deptFilter: string,
  scopedDepartments: string[]
): Promise<ActionTask[]> {
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("category", "weekly_action")
    .eq("week_number", weekFilter)
    .eq("year", yearFilter)
    .order("department", { ascending: true })
    .order("created_at", { ascending: true })

  if (scopedDepartments.length > 0) {
    query = query.in("department", scopedDepartments)
  }

  if (deptFilter !== "all") {
    query = query.eq("department", deptFilter)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
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

  const supabase = createClient()
  const canMutateTask = (task: ActionTask) => canGlobalEdit || editableDepartments.includes(task.department)

  const {
    data: tasks = [],
    isLoading: loading,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: QUERY_KEYS.adminActionTrackerTasks({ weekFilter, yearFilter, deptFilter, scopedDepartments }),
    queryFn: () => fetchAdminActionTrackerTasks(supabase, weekFilter, yearFilter, deptFilter, scopedDepartments),
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
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", taskId)

      if (error) throw error
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
      const { error } = await supabase.from("tasks").delete().eq("id", id)
      if (error) throw error
      toast.success("Action deleted")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminActionTrackerTasks() })
    } catch {
      toast.error("Failed to delete")
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

  return (
    <AdminTablePage
      title="Action Tracker"
      description="Monitor and manage weekly departmental actions"
      icon={FileSpreadsheet}
      backLinkHref="/admin/reports"
      backLinkLabel="Back to Reports"
      actions={
        tasks.length > 0 ? (
          <ActionTrackerExportButtons items={actionItemsForExport} weekFilter={weekFilter} yearFilter={yearFilter} />
        ) : null
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
