/**
 * Who may create a task, and for whom.
 *
 * Shared by POST /api/tasks and POST /api/task-series, so a recurring task is
 * held to exactly the rules a one-off is: only leads and admins create work,
 * a lead only inside their department scope, and every task names at least
 * one person.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getRequestScope } from "@/lib/admin/api-scope"
import { canAssignToDepartment, canAssignToProfile } from "@/lib/tasks/assignment-scope"
import { hasWorkLinkConflict, WORK_LINK_CONFLICT } from "@/lib/tasks/work-links"

export type TaskCreateRequest = {
  department?: string | null
  assigned_to?: string | null
  assigned_users?: string[] | null
  project_id?: string | null
  portfolio_id?: string | null
  status?: string | null
}

type CreatorProfile = {
  id: string
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

export type TaskCreateAuthority =
  | {
      ok: true
      isAdmin: boolean
      resolvedDepartment: string | null
      /** Everyone the work lands on, de-duplicated, primary assignee first. */
      targetUserIds: string[]
    }
  | { ok: false; response: Response }

export async function resolveTaskCreateAuthority(
  supabase: SupabaseClient,
  userId: string,
  payload: TaskCreateRequest
): Promise<TaskCreateAuthority> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, department, is_department_lead, lead_departments")
    .eq("id", userId)
    .single<CreatorProfile>()

  const scope = await getRequestScope()
  const isAdmin = Boolean(scope?.isAdminLike)
  const isLead = Boolean(profile?.is_department_lead)

  if (!isAdmin && !isLead) {
    return {
      ok: false,
      response: apiError(
        "Forbidden: Only department leads and administrators can create tasks",
        ApiErrorCode.FORBIDDEN,
        403
      ),
    }
  }

  if (hasWorkLinkConflict(payload.project_id, payload.portfolio_id)) {
    return { ok: false, response: apiError(WORK_LINK_CONFLICT, ApiErrorCode.VALIDATION_ERROR, 400) }
  }
  if (payload.project_id && payload.status !== "completed" && payload.status !== "cancelled") {
    const { data: linkedProject } = await supabase
      .from("projects")
      .select("status")
      .eq("id", payload.project_id)
      .maybeSingle<{ status: string | null }>()
    if (linkedProject?.status === "completed") {
      return {
        ok: false,
        response: apiError(
          "Cannot attach an uncompleted task to a completed project",
          ApiErrorCode.VALIDATION_ERROR,
          400
        ),
      }
    }
  }
  const resolvedDepartment = payload.department || profile?.department || null

  const targetUserIds: string[] = []
  if (payload.assigned_to) targetUserIds.push(payload.assigned_to)
  for (const uid of payload.assigned_users ?? []) {
    if (!targetUserIds.includes(uid)) targetUserIds.push(uid)
  }

  // Work with nobody responsible for it is not a task. There is no longer a
  // department-wide shape that opts out of this: a task for a whole team is a
  // multi-assign, which names every person it lands on.
  if (targetUserIds.length === 0) {
    return {
      ok: false,
      response: apiError("A task must be assigned to at least one person", ApiErrorCode.MISSING_REQUIRED_FIELD, 400),
    }
  }

  // A department lead may only create work inside their own scope.
  if (!isAdmin && isLead) {
    if (resolvedDepartment && !canAssignToDepartment(profile, resolvedDepartment)) {
      return {
        ok: false,
        response: apiError("You can only create tasks for your assigned department scope", ApiErrorCode.FORBIDDEN, 403),
      }
    }

    const { data: targetProfiles } = await supabase.from("profiles").select("id, department").in("id", targetUserIds)

    for (const target of (targetProfiles || []) as Array<{ id: string; department: string | null }>) {
      if (!canAssignToProfile(profile, target)) {
        return {
          ok: false,
          response: apiError(
            "You can only assign tasks to users within your departmental scope",
            ApiErrorCode.FORBIDDEN,
            403
          ),
        }
      }
    }
  }

  return { ok: true, isAdmin, resolvedDepartment, targetUserIds }
}
