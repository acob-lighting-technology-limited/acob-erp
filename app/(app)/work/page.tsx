import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WorkContent } from "./work-content"

type WorkItem = {
  id: string
  title: string
  work_item_number?: string | null
  source_type?: string | null
  category?: string | null
  status: string
  priority?: string | null
  department?: string | null
  due_date?: string | null
  assigned_by?: string | null
  source_id?: string | null
  project_id?: string | null
  created_at: string
}

export default async function WorkPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const [{ data: workRows }, { data: multiTaskAssignments }] = await Promise.all([
    supabase
      .from("unified_work")
      .select("*")
      .eq("assigned_to", user.id)
      .neq("category", "weekly_action")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("task_assignments").select("task_id").eq("user_id", user.id),
  ])

  const extraTaskIds = (multiTaskAssignments || []).map((row) => row.task_id)
  const { data: extraTasks } =
    extraTaskIds.length > 0
      ? await supabase
          .from("tasks")
          .select("*")
          .in("id", extraTaskIds)
          .neq("category", "weekly_action")
          .order("created_at", { ascending: false })
      : { data: [] }

  const merged = [...((workRows as WorkItem[] | null) || []), ...((extraTasks as WorkItem[] | null) || [])]
  const assignedByIds = Array.from(new Set(merged.map((item) => item.assigned_by).filter(Boolean))) as string[]
  const { data: profiles } =
    assignedByIds.length > 0
      ? await supabase.from("profiles").select("id, first_name, last_name").in("id", assignedByIds)
      : { data: [] }
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile] as const))
  const initialItems = Array.from(new Map(merged.map((item) => [item.id, item] as const)).values())
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .map((item) => ({
      ...item,
      assigned_by_name: item.assigned_by
        ? (() => {
            const profile = profileMap.get(item.assigned_by)
            return profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Unknown"
          })()
        : "Unknown",
    }))

  return <WorkContent initialItems={initialItems} />
}
