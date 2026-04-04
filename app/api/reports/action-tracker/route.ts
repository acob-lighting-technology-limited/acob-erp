import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"

const log = logger("action-tracker-route")

const CreateActionItemSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  department: z.string().trim().min(1),
  week_number: z.number().int().min(1).max(53).optional(),
  year: z.number().int().min(2000).max(9999).optional(),
})

type ScopeProfile = {
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

type ActionItemRow = {
  id: string
  title: string | null
  description: string | null
  status: string | null
  department: string | null
  week_number: number | null
  year: number | null
  original_week?: number | null
  created_at?: string | null
}

type WeeklyActionTaskRow = {
  id: string
  title: string | null
  description: string | null
  status: string | null
  priority: string | null
  department: string | null
  due_date: string | null
  week_number: number | null
  year: number | null
  work_item_number: string | null
  created_at?: string | null
}

function normalizeActionItemRow(row: ActionItemRow) {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    description: row.description || undefined,
    status: String(row.status || "pending"),
    priority: "medium",
    department: String(row.department || ""),
    due_date: undefined,
    week_number: Number(row.week_number || 0),
    year: Number(row.year || 0),
    original_week: row.original_week ?? undefined,
    work_item_number: undefined,
  }
}

function normalizeWeeklyActionTaskRow(row: WeeklyActionTaskRow) {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    description: row.description || undefined,
    status: String(row.status || "pending"),
    priority: String(row.priority || "medium"),
    department: String(row.department || ""),
    due_date: row.due_date || undefined,
    week_number: Number(row.week_number || 0),
    year: Number(row.year || 0),
    original_week: undefined,
    work_item_number: row.work_item_number || undefined,
  }
}

function canManageDepartment(profile: ScopeProfile | null, department: string) {
  const role = String(profile?.role || "").toLowerCase()
  if (["developer", "super_admin", "admin"].includes(role)) return true
  if (!profile?.is_department_lead) return false
  const leadDepartments = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  return profile.department === department || leadDepartments.includes(department)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = CreateActionItemSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, department, is_department_lead, lead_departments")
      .eq("id", user.id)
      .single<ScopeProfile>()

    if (!canManageDepartment(profile ?? null, parsed.data.department)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const officeWeek = getCurrentOfficeWeek()
    const { data: item, error } = await supabase
      .from("action_items")
      .insert({
        title: parsed.data.title,
        description: parsed.data.description || null,
        department: parsed.data.department,
        status: "not_started",
        week_number: parsed.data.week_number ?? officeWeek.week,
        year: parsed.data.year ?? officeWeek.year,
        assigned_by: user.id,
      })
      .select("*")
      .single()

    if (error || !item)
      return NextResponse.json({ error: error?.message || "Failed to create action item" }, { status: 500 })

    await writeAuditLog(
      supabase,
      {
        action: "action_item.create",
        entityType: "action_item",
        entityId: item.id,
        newValues: { title: item.title, department: item.department },
        context: { actorId: user.id, source: "api", route: "/api/reports/action-tracker" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: item }, { status: 201 })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in action tracker POST")
    return NextResponse.json({ error: "Failed to create action item" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const params = request.nextUrl.searchParams
    const week = Number(params.get("week"))
    const year = Number(params.get("year"))
    const dept = params.get("dept") || "all"
    const scopedDepartments = (params.get("scoped_departments") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)

    let actionItemsQuery = supabase
      .from("action_items")
      .select("id, title, department, description, status, week_number, year, original_week, created_at")
      .eq("week_number", week)
      .eq("year", year)
      .order("department", { ascending: true })
      .order("created_at", { ascending: true })

    let tasksQuery = supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, department, due_date, week_number, year, work_item_number, created_at"
      )
      .eq("category", "weekly_action")
      .eq("week_number", week)
      .eq("year", year)
      .order("department", { ascending: true })
      .order("created_at", { ascending: true })

    if (scopedDepartments.length > 0) {
      actionItemsQuery = actionItemsQuery.in("department", scopedDepartments)
      tasksQuery = tasksQuery.in("department", scopedDepartments)
    }
    if (dept !== "all") {
      actionItemsQuery = actionItemsQuery.eq("department", dept)
      tasksQuery = tasksQuery.eq("department", dept)
    }

    const [{ data: actionItems, error: actionItemsError }, { data: weeklyActionTasks, error: weeklyActionTasksError }] =
      await Promise.all([actionItemsQuery.returns<ActionItemRow[]>(), tasksQuery.returns<WeeklyActionTaskRow[]>()])

    if (actionItemsError) return NextResponse.json({ error: actionItemsError.message }, { status: 500 })
    if (weeklyActionTasksError) return NextResponse.json({ error: weeklyActionTasksError.message }, { status: 500 })

    const data = [
      ...(actionItems || []).map(normalizeActionItemRow),
      ...(weeklyActionTasks || []).map(normalizeWeeklyActionTaskRow),
    ].sort((a, b) => {
      const departmentCompare = a.department.localeCompare(b.department)
      if (departmentCompare !== 0) return departmentCompare
      return a.title.localeCompare(b.title)
    })

    return NextResponse.json({ data })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in action tracker GET")
    return NextResponse.json({ error: "Failed to fetch action items" }, { status: 500 })
  }
}
