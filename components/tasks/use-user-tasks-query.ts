"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/logger"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { Task, TaskUserProfile } from "@/types/task"
import { loadUserTasks } from "@/components/tasks/user-tasks-data"

const log = logger("tasks-user-tasks-query")

export interface TaskUpdate {
  id: string
  content?: string
  update_type: string
  created_at: string
  old_value?: string | null
  new_value?: string | null
  user?: {
    first_name: string
    last_name: string
  }
}

type TaskUpdateRow = Omit<TaskUpdate, "user"> & {
  user_id?: string | null
  user?: Array<{ first_name: string; last_name: string }> | { first_name: string; last_name: string } | null
}

async function loadTaskUpdates(supabase: ReturnType<typeof createClient>, taskId: string): Promise<TaskUpdate[]> {
  const { data, error } = await supabase
    .from("task_updates")
    .select("id, content, update_type, created_at, old_value, new_value, user_id")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })

  if (error) {
    log.error("Error loading task updates:", error)
    throw error
  }

  const rows = (data as TaskUpdateRow[] | null) || []
  const userIds = Array.from(new Set(rows.map((entry) => entry.user_id).filter(Boolean))) as string[]
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("profiles").select("id, first_name, last_name").in("id", userIds)
      : { data: [] }
  const profileMap = new Map(
    ((profiles as Array<{ id: string; first_name: string; last_name: string }> | null) || []).map((profile) => [
      profile.id,
      { first_name: profile.first_name, last_name: profile.last_name },
    ])
  )

  return rows.map((entry) => ({
    id: entry.id,
    content: entry.content,
    update_type: entry.update_type,
    created_at: entry.created_at,
    old_value: entry.old_value,
    new_value: entry.new_value,
    user: entry.user_id ? profileMap.get(entry.user_id) : undefined,
  }))
}

/** The signed-in user's task list. The server render seeds it; TanStack keeps it fresh. */
export function useUserTasksQuery(userId: string, userProfile: TaskUserProfile | null, initialTasks: Task[]) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery({
    queryKey: QUERY_KEYS.appTasks(userId),
    queryFn: () => loadUserTasks(supabase, userId, userProfile),
    initialData: initialTasks,
  })
}

/** Comments and status history for one task. Fetches only while a task is selected. */
export function useTaskUpdatesQuery(taskId: string | null) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery({
    queryKey: QUERY_KEYS.taskUpdates(taskId ?? ""),
    queryFn: () => loadTaskUpdates(supabase, taskId as string),
    enabled: Boolean(taskId),
  })
}
