import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { notificationTier } from "@/lib/notifications/tiers"
import { toLocalISODate } from "@/lib/utils/date"

export interface MyDayData {
  today: string
  attendance: { clockIn: string | null; clockOut: string | null; status: string | null } | null
  needsYou: Array<{ id: string; title: string; message: string; link: string | null; createdAt: string }>
  needsYouCount: number
  tasks: Array<{ id: string; title: string; dueDate: string | null; status: string; overdue: boolean }>
  lunch: { menuId: string; status: string; deadline: string | null; voted: boolean } | null
  away: Array<{ userId: string; name: string; until: string }>
}

/** Work still with the assignee ("submitted_for_review" is waiting on someone else). */
const OPEN_TASK_STATUSES = ["pending", "in_progress"]

/**
 * Everything the "My Day" home shows (audit 2.2), fetched in parallel on the
 * server. The viewer's own rows go through their session so RLS applies; only
 * "who is away" reads org-wide leave, and it returns names and dates — never
 * leave types or reasons.
 */
export async function loadMyDay(supabase: SupabaseClient, userId: string): Promise<MyDayData> {
  const today = toLocalISODate()
  const service = getServiceRoleClientOrFallback(supabase)

  const [attendanceRes, notificationsRes, tasksRes, menuRes, leaveRes] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("clock_in, clock_out, status")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id, type, priority, title, message, action_url, link_url, created_at")
      .eq("user_id", userId)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("tasks")
      .select("id, title, due_date, status")
      .eq("assigned_to", userId)
      .eq("is_archived", false)
      .in("status", OPEN_TASK_STATUSES)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("lunch_menus")
      .select("id, status, voting_deadline")
      .eq("date", today)
      .is("archived_at", null)
      .maybeSingle(),
    service
      .from("leave_requests")
      .select("user_id, end_date")
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today)
      .limit(50),
  ])

  const actionItems = (notificationsRes.data ?? []).filter((n) => notificationTier(n) === "action")

  let lunch: MyDayData["lunch"] = null
  if (menuRes.data && menuRes.data.status !== "draft") {
    const { data: vote } = await supabase
      .from("lunch_votes")
      .select("id")
      .eq("menu_id", menuRes.data.id)
      .eq("user_id", userId)
      .maybeSingle()
    lunch = {
      menuId: menuRes.data.id,
      status: menuRes.data.status,
      deadline: menuRes.data.voting_deadline,
      voted: Boolean(vote),
    }
  }

  const awayRows = (leaveRes.data ?? []).filter((row) => row.user_id !== userId)
  let away: MyDayData["away"] = []
  if (awayRows.length > 0) {
    const { data: people } = await service
      .from("staff_directory")
      .select("id, first_name, last_name")
      .in(
        "id",
        awayRows.map((row) => row.user_id)
      )
    const nameById = new Map(
      (people ?? []).map((p) => [
        p.id as string,
        [p.first_name, p.last_name].filter(Boolean).join(" ") || "A colleague",
      ])
    )
    away = awayRows.map((row) => ({
      userId: row.user_id,
      name: nameById.get(row.user_id) ?? "A colleague",
      until: row.end_date,
    }))
  }

  return {
    today,
    attendance: attendanceRes.data
      ? {
          clockIn: attendanceRes.data.clock_in,
          clockOut: attendanceRes.data.clock_out,
          status: attendanceRes.data.status,
        }
      : null,
    needsYou: actionItems.slice(0, 5).map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      link: n.action_url ?? n.link_url,
      createdAt: n.created_at,
    })),
    needsYouCount: actionItems.length,
    tasks: (tasksRes.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.due_date,
      status: t.status,
      overdue: Boolean(t.due_date && t.due_date.slice(0, 10) < today),
    })),
    lunch,
    away,
  }
}
