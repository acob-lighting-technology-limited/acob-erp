"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { EMPTY_TASK_FORM, TaskFormDialog, type TaskFormState } from "@/components/tasks/TaskFormDialog"
import { createSeriesFromForm, isRepeating, showSeriesCreated } from "@/lib/tasks/series-client"
import type { employee } from "@/app/admin/tasks/management/admin-tasks-content"
import { apiJson } from "@/lib/api-client"
import { portfolioTasksKey } from "@/lib/projects/work-tasks"
import { portfolioLabel } from "@/lib/tasks/work-links"
import { toLocalISODate } from "@/lib/utils/date"

type StaffOption = {
  id: string
  first_name: string
  last_name: string
  full_name?: string | null
  department: string
}

/**
 * "Add Task" on a portfolio's Tasks tab: the standard task form with the
 * portfolio fixed, so the task is portfolio-wide work. Saved through
 * POST /api/tasks like every other task — same deadline rule, KPI, weight
 * and notifications.
 */
export function PortfolioTaskDialog({
  open,
  onOpenChange,
  portfolio,
  profiles,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolio: { id: string; name: string; code: string | null }
  profiles: StaffOption[]
}) {
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)
  const [taskForm, setTaskForm] = useState<TaskFormState>(() => ({
    ...EMPTY_TASK_FORM,
    portfolio_id: portfolio.id,
    task_start_date: toLocalISODate(),
  }))

  async function handleSave(form: TaskFormState) {
    if (isSaving) return
    setIsSaving(true)
    try {
      if (isRepeating(form)) {
        // Repeat set: portfolio-wide work on a schedule.
        showSeriesCreated(await createSeriesFromForm(form, { portfolio_id: portfolio.id, project_id: null }))
        onOpenChange(false)
        setTaskForm({ ...EMPTY_TASK_FORM, portfolio_id: portfolio.id, task_start_date: toLocalISODate() })
        void queryClient.invalidateQueries({ queryKey: portfolioTasksKey(portfolio.id) })
        return
      }
      await apiJson("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          priority: form.priority,
          status: "pending",
          due_date: form.due_date || null,
          department: form.department || null,
          assignment_type: form.assignment_type,
          assigned_to: form.assigned_to || null,
          assigned_users: form.assigned_users || [],
          goal_id: form.goal_id || null,
          kpi_id: form.kpi_id || null,
          portfolio_id: portfolio.id,
          weight: form.weight,
          task_start_date: form.task_start_date || null,
          task_end_date: form.task_end_date || null,
          source_type: "manual",
        }),
      })
      toast.success("Task added to the portfolio")
      onOpenChange(false)
      setTaskForm({ ...EMPTY_TASK_FORM, portfolio_id: portfolio.id, task_start_date: toLocalISODate() })
      void queryClient.invalidateQueries({ queryKey: portfolioTasksKey(portfolio.id) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save task")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <TaskFormDialog
      isOpen={open}
      onOpenChange={onOpenChange}
      selectedTask={null}
      taskForm={taskForm}
      setTaskForm={setTaskForm}
      onSave={handleSave}
      isSaving={isSaving}
      scopedAssignableEmployees={profiles as employee[]}
      scopedAssignableDepartments={Array.from(new Set(profiles.map((p) => p.department).filter(Boolean)))}
      lockedPortfolioId={portfolio.id}
      lockedPortfolioName={portfolioLabel(portfolio)}
    />
  )
}
