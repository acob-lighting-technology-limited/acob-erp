import { TONE_CLASSES } from "@/lib/ui/status-tones"
export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "submitted_for_review",
  "completed",
  "unable_to_complete",
  "reassigned",
  "failed",
  "cancelled",
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

// Department-wide assignment was retired: work assigned to "the department"
// belonged to nobody's list and nobody's score. A task for a whole team is now
// a multi-assign, which fans out one row per person so everyone is measured on
// the same footing.
export const TASK_ASSIGNMENT_TYPES = ["individual", "multiple"] as const
export type TaskAssignmentType = (typeof TASK_ASSIGNMENT_TYPES)[number]

export interface TaskStatusConfig {
  label: string
  color: string
  badgeVariant: "default" | "secondary" | "destructive" | "outline"
  description: string
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, TaskStatusConfig> = {
  pending: {
    label: "Pending",
    color: TONE_CLASSES.warning,
    badgeVariant: "outline",
    description: "Task is assigned and awaiting commencement.",
  },
  in_progress: {
    label: "In Progress",
    color: TONE_CLASSES.info,
    badgeVariant: "default",
    description: "Task is actively being worked on.",
  },
  submitted_for_review: {
    label: "Submitted for Review",
    color: TONE_CLASSES.purple,
    badgeVariant: "secondary",
    description: "Employee has submitted work for lead/admin approval.",
  },
  completed: {
    label: "Completed",
    color: TONE_CLASSES.success,
    badgeVariant: "default",
    description: "Task has been approved and completed.",
  },
  unable_to_complete: {
    label: "Unable to Complete",
    color: TONE_CLASSES.warning,
    badgeVariant: "destructive",
    description: "Employee reported an issue blocking completion.",
  },
  reassigned: {
    label: "Reassigned",
    color: TONE_CLASSES.info,
    badgeVariant: "outline",
    description: "Task was reassigned to another person (neutral for employee KPI).",
  },
  failed: {
    label: "Failed",
    color: TONE_CLASSES.danger,
    badgeVariant: "destructive",
    description: "Task was marked as failed / expired without completion.",
  },
  cancelled: {
    label: "Cancelled",
    color: TONE_CLASSES.neutral,
    badgeVariant: "outline",
    description: "Task was cancelled.",
  },
}

/** Why a reviewer cancelled a task. Cancelled work is neutral for the KPI. */
export const TASK_CANCEL_REASONS = ["not_planned", "duplicate", "other"] as const
export type TaskCancelReason = (typeof TASK_CANCEL_REASONS)[number]

export const TASK_CANCEL_REASON_LABELS: Record<TaskCancelReason, string> = {
  not_planned: "Not planned / no longer needed",
  duplicate: "Duplicate",
  other: "Other",
}

export function formatTaskStatus(status: string | null | undefined): string {
  if (!status) return "Pending"
  const normalized = status.toLowerCase() as TaskStatus
  return TASK_STATUS_CONFIG[normalized]?.label || status.replaceAll("_", " ")
}
