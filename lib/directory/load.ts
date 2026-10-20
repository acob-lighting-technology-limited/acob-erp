import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { normalizeDepartmentName, normalizeDepartmentList } from "@/shared/departments"
import { getAvatarSignedUrls } from "@/lib/profile-photos"

// Company directory: contact fields every employee is allowed to see. Deliberately
// excludes sensitive HR data (DOB, salary, employee number, leave, attendance, etc.).
// avatar_path is read but never returned — it is exchanged for a short-lived signed URL,
// since profile photos live in a private bucket.
const DIRECTORY_COLUMNS =
  "id, first_name, last_name, full_name, company_email, additional_email, phone_number, additional_phone, department, designation, office_location, is_department_lead, lead_departments, employment_status, employment_type, avatar_path"

type DirectoryProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  company_email: string | null
  additional_email: string | null
  phone_number: string | null
  additional_phone: string | null
  department: string | null
  designation: string | null
  office_location: string | null
  is_department_lead: boolean | null
  lead_departments: string[] | null
  employment_status: string | null
  employment_type: string | null
  avatar_path: string | null
}

export type DirectoryEntry = Omit<DirectoryProfile, "avatar_path"> & { avatar_url: string | null }

/**
 * The org-wide directory for a signed-in employee — shared by GET /api/directory
 * and the /directory page's server prefetch so both return the same rows.
 * Callers must have checked the user is signed in. Throws on a query failure.
 */
export async function loadDirectory(supabase: SupabaseClient): Promise<DirectoryEntry[]> {
  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data, error } = await dataClient
    .from("profiles")
    .select(DIRECTORY_COLUMNS)
    .order("last_name", { ascending: true })
  if (error) throw new Error(error.message)

  // Hide people who have left, and normalise department names so renamed
  // departments (e.g. "Technical Extension" → "Project") show their canonical name.
  const visible = ((data as unknown as DirectoryProfile[] | null) ?? []).filter((r) => r.employment_status !== "exited")

  const signedUrlsByPath = await getAvatarSignedUrls(
    dataClient,
    visible.map((r) => r.avatar_path).filter((path): path is string => Boolean(path))
  )

  return visible.map(({ avatar_path, ...r }) => ({
    ...r,
    department: r.department ? normalizeDepartmentName(r.department) : r.department,
    lead_departments: r.lead_departments?.length ? normalizeDepartmentList(r.lead_departments) : r.lead_departments,
    avatar_url: avatar_path ? (signedUrlsByPath.get(avatar_path) ?? null) : null,
  }))
}
