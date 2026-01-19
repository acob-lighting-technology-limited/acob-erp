import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NotificationContent } from "./notification-content"

export interface Notification {
  id: string
  user_id: string
  type: string
  category: string
  priority: string
  title: string
  message: string
  rich_content?: any
  link_url?: string
  link_text?: string
  action_buttons?: any
  actor_id?: string
  actor_name?: string
  actor_avatar?: string
  entity_type?: string
  entity_id?: string
  read: boolean
  read_at?: string
  archived: boolean
  clicked: boolean
  created_at: string
  expires_at?: string
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
    .eq("archived", false)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error loading notifications:", error)
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

  const notificationData = data as { notifications: Notification[]; userId: string }

  return <NotificationContent initialNotifications={notificationData.notifications} userId={notificationData.userId} />
}
