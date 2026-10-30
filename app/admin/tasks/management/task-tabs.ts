import { ClipboardList, Repeat, Users, type LucideIcon } from "lucide-react"
import type { DataTableTab } from "@/components/ui/data-table"

export type TaskTab = "tasks" | "user_plan" | "recurring"

export const TASK_TABS: DataTableTab[] = [
  { key: "tasks", label: "All Tasks", icon: ClipboardList },
  { key: "user_plan", label: "User Task Plan", icon: Users },
  { key: "recurring", label: "Recurring", icon: Repeat },
]

/** The page header for each tab of the admin task page. */
export const TAB_COPY: Record<TaskTab, { title: string; description: string; icon: LucideIcon }> = {
  tasks: {
    title: "Task Management",
    description: "Operational task tracking, multi-user assignment, and PMS review governance.",
    icon: ClipboardList,
  },
  user_plan: {
    title: "User Task Plan & Workload",
    description: "User-level task workload, period filters, weight points, and appraisal ratings.",
    icon: Users,
  },
  recurring: {
    title: "Recurring Tasks",
    description: "Every recurring task series, including ones whose first repeat has not been created yet.",
    icon: Repeat,
  },
}
