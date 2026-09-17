import "server-only"

import type { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

type DbClient = Awaited<ReturnType<typeof createClient>>

/**
 * Active staff for the project pages' dialogs: project manager options and
 * task assignees. Names and email are never blank, matching the shape the task
 * form expects.
 */
export async function loadAssignableStaff(supabase: DbClient) {
  const { data, error } = await getServiceRoleClientOrFallback(supabase)
    .from("profiles")
    .select("id, first_name, last_name, full_name, department, company_email")
    .neq("employment_status", "exited")
    .order("first_name", { ascending: true })

  if (error) {
    console.error("Error loading staff for project pages:", error)
  }

  return (data || []).map((profile) => ({
    id: profile.id,
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    full_name: profile.full_name,
    company_email: profile.company_email || "",
    department: profile.department || "",
  }))
}
