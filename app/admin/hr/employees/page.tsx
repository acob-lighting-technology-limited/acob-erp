import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminStaffContent, type Staff, type UserProfile } from "./admin-staff-content"

async function getAdminStaffData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Get user profile
  const { data: profile } = await supabase.from("profiles").select("role, lead_departments").eq("id", user.id).single()

  if (!profile || !["super_admin", "admin", "lead"].includes(profile.role)) {
    return { redirect: "/dashboard" as const }
  }

  const userProfile: UserProfile = {
    role: profile.role,
  }

  // Fetch staff - leads can only see staff in their departments
  let query = supabase.from("profiles").select("*").order("last_name", { ascending: true })

  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    query = query.in("department", profile.lead_departments)
  }

  const { data: staffData, error: staffError } = await query

  if (staffError) {
    console.error("Error loading staff:", staffError)
    return { staff: [], userProfile }
  }

  return {
    staff: (staffData || []) as Staff[],
    userProfile,
  }
}

export default async function AdminStaffPage() {
  const data = await getAdminStaffData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    staff: Staff[]
    userProfile: UserProfile
  }

  return <AdminStaffContent initialStaff={pageData.staff} userProfile={pageData.userProfile} />
}
