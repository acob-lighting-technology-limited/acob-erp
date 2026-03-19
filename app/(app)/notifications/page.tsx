import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NotificationContent } from "./notification-content"

import { logger } from "@/lib/logger"

const log = logger("notification")

export interface Notification {
  id: string
  user_id: string
  type: string
  category: string
  priority: string
  title: string
  message: string
  data?: Record<string, unknown> | null
  action_url?: string | null
  actor_name?: string
  actor_avatar?: string
  read: boolean
  read_at?: string
  created_at: string
}

async function getNotificationData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    log.error("Error loading notifications:", error)
  }

  return {
    notifications: (data || []) as Notification[],
    userId: user.id,
  }
}

export default async function NotificationPage() {
  const data = await getNotificationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const notificationData = data as Exclude<Awaited<ReturnType<typeof getNotificationData>>, { redirect: "/auth/login" }>

  return <NotificationContent initialNotifications={notificationData.notifications} userId={notificationData.userId} />
}
