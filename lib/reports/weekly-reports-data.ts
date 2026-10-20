import type { SupabaseClient } from "@supabase/supabase-js"
import { sortReportsByDepartment } from "@/lib/export/shared"
import type { WeeklyReport } from "@/lib/export-utils"
import { getDepartmentAliases } from "@/shared/departments"

/**
 * Data for the staff weekly-reports page. Takes either Supabase client: the page
 * prefetches on the server with the request session, and the client refetches
 * with the browser session — the same RLS applies to both.
 */

export interface UserProfile {
  id: string
  department: string | null
  role: string
  is_department_lead: boolean
  lead_departments?: string[] | null
}

export interface TrackerStatus {
  id: string
  department: string
  status: string
}

export interface WeeklyReportsData {
  reports: WeeklyReport[]
  trackingData: TrackerStatus[]
}

export async function fetchProfileAndDepartments(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { profile: null as UserProfile | null, allDepartments: [] as string[] }
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, department, role, is_department_lead, lead_departments")
    .eq("id", user.id)
    .single()

  // staff_directory, not profiles: profiles RLS would reduce this to the
  // caller's own department, leaving the filter dropdown with one entry.
  const { data: departmentsData } = await supabase
    .from("staff_directory")
    .select("department")
    .not("department", "is", null)

  const allDepartments = Array.from(
    new Set(
      (departmentsData || [])
        .map((row) => row.department)
        .filter((department): department is string => Boolean(department))
    )
  ).sort((a, b) => a.localeCompare(b))

  return {
    profile: profileData as UserProfile | null,
    allDepartments,
  }
}

export async function fetchWeeklyReports(
  supabase: SupabaseClient,
  week: number,
  year: number,
  deptFilter: string
): Promise<WeeklyReportsData> {
  // The submitter name is resolved separately rather than embedded as
  // profiles(...): the embed runs under profiles RLS, which hides everyone but
  // the caller and rendered "Submitted By" as "Unknown" for plain employees.
  let query = supabase
    .from("weekly_reports")
    .select(
      "id, department, week_number, year, work_done, tasks_new_week, challenges, status, user_id, created_at, updated_at"
    )
    .eq("status", "submitted")
    .eq("week_number", week)
    .eq("year", year)
    .order("department", { ascending: true })

  if (deptFilter !== "all") {
    query = query.eq("department", deptFilter)
  }

  const { data: reportsData, error } = await query
  if (error) throw new Error(error.message)

  const submitterIds = Array.from(
    new Set((reportsData || []).map((report) => report.user_id).filter((id): id is string => Boolean(id)))
  )

  const submitterById = new Map<string, { first_name: string | null; last_name: string | null }>()
  if (submitterIds.length > 0) {
    const { data: submitters } = await supabase
      .from("staff_directory")
      .select("id, first_name, last_name")
      .in("id", submitterIds)
    for (const submitter of submitters || []) {
      submitterById.set(String(submitter.id), {
        first_name: submitter.first_name,
        last_name: submitter.last_name,
      })
    }
  }

  const reports = sortReportsByDepartment(
    (reportsData || []).map((report) => ({
      ...report,
      profiles: report.user_id ? (submitterById.get(report.user_id) ?? null) : null,
    })) as WeeklyReport[]
  )
  const departments = Array.from(new Set(reports.map((report) => report.department))).filter(Boolean)
  const departmentsForTasks = Array.from(new Set(departments.flatMap((department) => getDepartmentAliases(department))))

  if (departments.length === 0) {
    return { reports, trackingData: [] }
  }

  const { data: tasksData, error: tasksError } = await supabase
    .from("tasks")
    .select("id, department, status")
    .eq("category", "weekly_action")
    .eq("week_number", week)
    .eq("year", year)
    .in("department", departmentsForTasks)

  if (tasksError) {
    return { reports, trackingData: [] }
  }

  return {
    reports,
    trackingData: (tasksData || []) as TrackerStatus[],
  }
}
