import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { ProfileContent } from "./profile-content"

export interface UserProfile {
  id: string
  first_name: string
  last_name: string
  other_names: string | null
  company_email: string
  department: string
  company_role: string | null
  role: string
  phone_number: string | null
  additional_phone: string | null
  residential_address: string | null
  office_location: string | null
  is_admin: boolean
  is_department_lead: boolean
  lead_departments: string[]
  employment_date: string | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  department: string | null
  due_date: string | null
  created_at: string
  assignment_type?: "individual" | "multiple" | "department"
}

export interface Asset {
  id: string
  asset_name?: string
  asset_type: string
  asset_model: string | null
  serial_number: string | null
  unique_code: string | null
  status: string
  assigned_at: string
  assignment_type?: "individual" | "department" | "office"
  department?: string
  office_location?: string
}

export interface Documentation {
  id: string
  title: string
  category: string | null
  created_at: string
}

export interface Feedback {
  id: string
  feedback_type: string
  title: string
  description: string | null
  status: string
  created_at: string
}

type ProfileRow = UserProfile & {
  department_id?: string | null
}

type DepartmentNameRow = {
  name: string
}

type TaskAssignmentRow = {
  task_id: string
}

type AssetRow = Asset & {
  created_at?: string
  deleted_at?: string | null
}

type AssetAssignmentRow = {
  assigned_at: string
  asset: AssetRow | null
}

const isDefined = <T,>(value: T | null | undefined): value is T => value != null

async function getProfileData() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)
  const loadErrors: string[] = []

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const userId = user.id

  // Load profile
  const { data: profileData, error: profileError } = await dataClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single<ProfileRow>()

  if (profileError || !profileData) {
    return { profile: null, tasks: [], assets: [], documentation: [], feedback: [] }
  }

  let resolvedDepartment = profileData.department || null
  if (profileData.department_id) {
    const { data: deptById } = await dataClient
      .from("departments")
      .select("name")
      .eq("id", profileData.department_id)
      .maybeSingle<DepartmentNameRow>()
    if (deptById?.name) resolvedDepartment = deptById.name
  }
  if (String(resolvedDepartment || "").toLowerCase() === "finance") {
    resolvedDepartment = "Accounts"
  }

  // Load tasks assigned to user (individual, multiple-user, and department tasks)
  const { data: individualTasks, error: individualTasksError } = await dataClient
    .from("tasks")
    .select("*")
    .eq("assigned_to", userId)
    .order("created_at", { ascending: false })
  if (individualTasksError) loadErrors.push("tasks")

  // Load multiple-user tasks
  const { data: taskAssignments, error: taskAssignmentsError } = await dataClient
    .from("task_assignments")
    .select("task_id")
    .eq("user_id", userId)
    .returns<TaskAssignmentRow[]>()
  if (taskAssignmentsError) loadErrors.push("tasks")

  let multipleUserTasks: Task[] = []
  if (taskAssignments && taskAssignments.length > 0) {
    const taskIds = taskAssignments.map((ta) => ta.task_id)
    const { data: tasksData, error: tasksDataError } = await dataClient
      .from("tasks")
      .select("*")
      .in("id", taskIds)
      .eq("assignment_type", "multiple")
      .order("created_at", { ascending: false })
    if (tasksData) multipleUserTasks = tasksData
    if (tasksDataError) loadErrors.push("tasks")
  }

  // Load department tasks
  const { data: departmentTasks, error: departmentTasksError } = await dataClient
    .from("tasks")
    .select("*")
    .eq("department", resolvedDepartment)
    .eq("assignment_type", "department")
    .order("created_at", { ascending: false })
  if (departmentTasksError) loadErrors.push("tasks")

  const allTasks = [...(individualTasks || []), ...multipleUserTasks, ...(departmentTasks || [])]

  // Load assets assigned to user (individual)
  const { data: individualAssignments, error: individualAssignmentsError } = await dataClient
    .from("asset_assignments")
    .select(
      `
      assigned_at,
      asset:assets(
        id,
        asset_type,
        asset_model,
        serial_number,
        status,
        unique_code,
        created_at,
        deleted_at
      )
    `
    )
    .eq("assigned_to", userId)
    .eq("is_current", true)
    .returns<AssetAssignmentRow[]>()
  if (individualAssignmentsError) loadErrors.push("assets")

  // Load department and office assets (separate queries to avoid filter parsing issues with commas in names)
  const [departmentAssetsRes, officeAssetsRes] = await Promise.all([
    resolvedDepartment
      ? dataClient
          .from("assets")
          .select("*")
          .eq("status", "assigned")
          .is("deleted_at", null)
          .eq("assignment_type", "department")
          .eq("department", resolvedDepartment)
      : Promise.resolve({ data: [] as AssetRow[], error: null }),
    profileData.office_location
      ? dataClient
          .from("assets")
          .select("*")
          .eq("status", "assigned")
          .is("deleted_at", null)
          .eq("assignment_type", "office")
          .eq("office_location", profileData.office_location)
      : Promise.resolve({ data: [] as AssetRow[], error: null }),
  ])
  if (departmentAssetsRes.error || officeAssetsRes.error) loadErrors.push("assets")
  const sharedAssets = [...(departmentAssetsRes.data || []), ...(officeAssetsRes.data || [])]

  let allAssets: Asset[] = []

  // Process individual assignments
  if (individualAssignments) {
    const indAssets = individualAssignments
      .map((a): Asset | null =>
        a.asset && !a.asset.deleted_at
          ? {
              ...a.asset,
              assigned_at: a.assigned_at,
              assignment_type: "individual",
            }
          : null
      )
      .filter(isDefined)
    allAssets = [...allAssets, ...indAssets]
  }

  // Process shared assets
  if (sharedAssets) {
    const shAssets = sharedAssets.map((a) => ({
      ...a,
      assigned_at: a.created_at, // Use created_at for shared assets
      assignment_type: a.assignment_type,
    }))
    allAssets = [...allAssets, ...shAssets]
  }

  // Load documentation created by user
  const { data: docsData, error: docsError } = await dataClient
    .from("user_documentation")
    .select("id, title, category, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (docsError) loadErrors.push("documentation")

  // Load feedback submitted by user
  const { data: feedbackData, error: feedbackError } = await dataClient
    .from("feedback")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (feedbackError) loadErrors.push("feedback")

  const loadError = loadErrors.length > 0 ? "Some profile sections failed to load. Please refresh." : null

  return {
    profile: profileData,
    tasks: allTasks,
    assets: allAssets,
    documentation: (docsData || []) as Documentation[],
    feedback: (feedbackData || []) as Feedback[],
    loadError,
  }
}

export default async function ProfilePage() {
  const data = await getProfileData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  // Type assertion since we've checked for redirect above
  const profileData = data as Exclude<Awaited<ReturnType<typeof getProfileData>>, { redirect: "/auth/login" }>

  return (
    <ProfileContent
      profile={profileData.profile}
      tasks={profileData.tasks}
      assets={profileData.assets}
      documentation={profileData.documentation}
      feedback={profileData.feedback}
      initialError={profileData.loadError}
    />
  )
}
