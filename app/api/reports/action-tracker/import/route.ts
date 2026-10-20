import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { serverError, validationError } from "@/lib/api/errors"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { canEditActionContent, type ActionTrackerScopeProfile } from "@/lib/reports/action-tracker-permissions"

const log = logger("action-tracker-import")

const ImportSchema = z.object({
  week_number: z.number().int().min(1).max(53),
  year: z.number().int().min(2000).max(9999),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(255),
        description: z.string().trim().max(1000).optional().nullable(),
        department: z.string().trim().min(1).max(100),
      })
    )
    .min(1)
    .max(500),
})

/**
 * POST /api/reports/action-tracker/import — bulk-create action items from an
 * Excel sheet. Every row's department is checked with the same rule as a single
 * create; the batch is rejected whole if any row is outside the caller's scope.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`action-tracker-import:${getClientId(request)}`, { limit: 5, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    // validated below
  }
  const parsed = ImportSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, department, is_department_lead, lead_departments")
    .eq("id", user.id)
    .single<ActionTrackerScopeProfile>()

  const departments = Array.from(new Set(parsed.data.items.map((item) => item.department)))
  const denied = departments.filter(
    (department) => !canEditActionContent(profile ?? null, { department }, { isAdminContext: true })
  )
  if (denied.length > 0) {
    return NextResponse.json({ error: `You cannot add actions for: ${denied.join(", ")}` }, { status: 403 })
  }

  const rows = parsed.data.items.map((item) => ({
    title: item.title,
    description: item.description || null,
    department: item.department,
    week_number: parsed.data.week_number,
    year: parsed.data.year,
    assigned_by: user.id,
    status: "not_started",
    origin: "weekly_report",
  }))

  const { error } = await supabase.from("action_items").insert(rows)
  if (error) return serverError(log, error, "Could not import the actions")

  await writeAuditLog(
    supabase,
    {
      action: "create",
      entityType: "action_item",
      entityId: `import:${parsed.data.year}-W${parsed.data.week_number}`,
      newValues: { count: rows.length, departments },
      context: { actorId: user.id, source: "api", route: "/api/reports/action-tracker/import" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ ok: true, count: rows.length })
}
