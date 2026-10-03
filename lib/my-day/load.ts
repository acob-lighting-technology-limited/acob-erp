import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { notificationTier } from "@/lib/notifications/tiers"
import { toLocalISODate } from "@/lib/utils/date"

/**
 * Data for the "My Day" home (audit 2.2), one loader per card so each card can
 * stream on its own (audit 8.7). The viewer's own rows go through their
 * session so RLS applies; only "who is away" reads org-wide leave, and it
 * returns names and dates — never leave types or reasons.
 */

export type MyAttendance = { clockIn: string | null; clockOut: string | null; status: string | null } | null

export async function loadMyAttendance(supabase: SupabaseClient, userId: string): Promise<MyAttendance> {
  const { data } = await supabase
    .from("attendance_records")
    .select("clock_in, clock_out, status")
    .eq("user_id", userId)
    .eq("date", toLocalISODate())
    .maybeSingle()
  return data ? { clockIn: data.clock_in, clockOut: data.clock_out, status: data.status } : null
}

export type NeedsYou = {
  count: number
  items: Array<{ id: string; title: string; message: string; link: string | null; createdAt: string }>
}

export async function loadNeedsYou(supabase: SupabaseClient, userId: string): Promise<NeedsYou> {
  const { data } = await supabase
    .from("notifications")
    .select("id, type, priority, title, message, action_url, link_url, created_at")
    .eq("user_id", userId)
    .eq("read", false)
    .order("created_at", { ascending: false })
    .limit(100)
  const actionItems = (data ?? []).filter((n) => notificationTier(n) === "action")
  return {
    count: actionItems.length,
    items: actionItems.slice(0, 5).map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      link: n.action_url ?? n.link_url,
      createdAt: n.created_at,
    })),
  }
}

/** Work still with the assignee ("submitted_for_review" is waiting on someone else). */
const OPEN_TASK_STATUSES = ["pending", "in_progress"]

export type MyTask = { id: string; title: string; dueDate: string | null; status: string; overdue: boolean }

export async function loadMyTasks(supabase: SupabaseClient, userId: string): Promise<MyTask[]> {
  const today = toLocalISODate()
  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_date, status")
    .eq("assigned_to", userId)
    .eq("is_archived", false)
    .in("status", OPEN_TASK_STATUSES)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(8)
  return (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.due_date,
    status: t.status,
    overdue: Boolean(t.due_date && t.due_date.slice(0, 10) < today),
  }))
}

export type MyLunch = { menuId: string; status: string; deadline: string | null; voted: boolean } | null

export async function loadMyLunch(supabase: SupabaseClient, userId: string): Promise<MyLunch> {
  const { data: menu } = await supabase
    .from("lunch_menus")
    .select("id, status, voting_deadline")
    .eq("date", toLocalISODate())
    .is("archived_at", null)
    .maybeSingle()
  if (!menu || menu.status === "draft") return null
  const { data: vote } = await supabase
    .from("lunch_votes")
    .select("id")
    .eq("menu_id", menu.id)
    .eq("user_id", userId)
    .maybeSingle()
  return { menuId: menu.id, status: menu.status, deadline: menu.voting_deadline, voted: Boolean(vote) }
}

export type AwayPerson = { userId: string; name: string; until: string }

export async function loadAwayToday(supabase: SupabaseClient, userId: string): Promise<AwayPerson[]> {
  const today = toLocalISODate()
  const service = getServiceRoleClientOrFallback(supabase)
  const { data: leave } = await service
    .from("leave_requests")
    .select("user_id, end_date")
    .eq("status", "approved")
    .lte("start_date", today)
    .gte("end_date", today)
    .limit(50)
  const rows = (leave ?? []).filter((row) => row.user_id !== userId)
  if (rows.length === 0) return []
  const { data: people } = await service
    .from("staff_directory")
    .select("id, first_name, last_name")
    .in(
      "id",
      rows.map((row) => row.user_id)
    )
  const nameById = new Map(
    (people ?? []).map((p) => [p.id as string, [p.first_name, p.last_name].filter(Boolean).join(" ") || "A colleague"])
  )
  return rows.map((row) => ({
    userId: row.user_id,
    name: nameById.get(row.user_id) ?? "A colleague",
    until: row.end_date,
  }))
}
