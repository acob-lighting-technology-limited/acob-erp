import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
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
  current_work_location: string | null
  is_admin: boolean
  is_department_lead: boolean
  lead_departments: string[]
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

async function getProfileData() {
  const supabase = await createClient()

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
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()

  if (profileError || !profileData) {
    return { profile: null, tasks: [], assets: [], documentation: [], feedback: [] }
  }

  // Load tasks assigned to user (individual, multiple-user, and department tasks)
  const { data: individualTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to", userId)
    .order("created_at", { ascending: false })

  // Load multiple-user tasks
  const { data: taskAssignments } = await supabase.from("task_assignments").select("task_id").eq("user_id", userId)

  let multipleUserTasks: Task[] = []
  if (taskAssignments && taskAssignments.length > 0) {
    const taskIds = taskAssignments.map((ta: any) => ta.task_id)
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("*")
      .in("id", taskIds)
      .eq("assignment_type", "multiple")
      .order("created_at", { ascending: false })
    if (tasksData) multipleUserTasks = tasksData
  }

  // Load department tasks
  const { data: departmentTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("department", profileData.department)
    .eq("assignment_type", "department")
    .order("created_at", { ascending: false })

  const allTasks = [...(individualTasks || []), ...multipleUserTasks, ...(departmentTasks || [])]

  // Load assets assigned to user (individual)
  const { data: individualAssignments } = await supabase
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
        created_at
      )
    `
    )
    .eq("assigned_to", userId)
    .eq("is_current", true)

  // Load department and office assets
  const { data: sharedAssets } = await supabase
    .from("assets")
    .select("*")
    .eq("status", "assigned")
    .or(
      `and(assignment_type.eq.department,department.eq.${profileData.department}),and(assignment_type.eq.office,office_location.eq.${profileData.current_work_location})`
    )

  let allAssets: Asset[] = []

  // Process individual assignments
  if (individualAssignments) {
    const indAssets = individualAssignments.map((a: any) => ({
      ...a.asset,
      assigned_at: a.assigned_at,
      assignment_type: "individual" as const,
    }))
    allAssets = [...allAssets, ...indAssets]
  }

  // Process shared assets
  if (sharedAssets) {
    const shAssets = sharedAssets.map((a: any) => ({
      ...a,
      assigned_at: a.created_at, // Use created_at for shared assets
      assignment_type: a.assignment_type,
    }))
    allAssets = [...allAssets, ...shAssets]
  }

  // Load documentation created by user
  const { data: docsData } = await supabase
    .from("user_documentation")
    .select("id, title, category, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  // Load feedback submitted by user
  const { data: feedbackData } = await supabase
    .from("feedback")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  return {
    profile: profileData as UserProfile,
    tasks: allTasks as Task[],
    assets: allAssets as Asset[],
    documentation: (docsData || []) as Documentation[],
    feedback: (feedbackData || []) as Feedback[],
  }
}

export default async function ProfilePage() {
  const data = await getProfileData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  // Type assertion since we've checked for redirect above
  const profileData = data as {
    profile: UserProfile | null
    tasks: Task[]
    assets: Asset[]
    documentation: Documentation[]
    feedback: Feedback[]
  }

  return (
    <ProfileContent
      profile={profileData.profile}
      tasks={profileData.tasks}
      assets={profileData.assets}
      documentation={profileData.documentation}
      feedback={profileData.feedback}
    />
  )
}
