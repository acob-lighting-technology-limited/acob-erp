import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/help-desk/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { loadAwayToday } from "@/lib/admin/away-today"
import { isAssignableProfile } from "@/lib/workforce/assignment-policy"
import { toLocalISODate } from "@/lib/utils/date"
import { formatFullName } from "@/lib/utils"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const log = logger("api-help-desk-assignees")

type StaffDirectoryRow = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  department: string | null
  employment_status: string | null
}

const QuerySchema = z.object({
  department: z.string().trim().min(1, "Department is required"),
})

export async function GET(request: NextRequest) {
  const rl = await rateLimit(`help-desk-assignees:${getClientId(request)}`, {
    limit: 60,
    windowSec: 60,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  }

  try {
    const { supabase, user } = await getAuthContext()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = QuerySchema.safeParse({
      department: searchParams.get("department") ?? "",
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid department", code: "VALIDATION_FAILED" },
        { status: 400 }
      )
    }

    const { department } = parsed.data
    const serviceClient = getServiceRoleClientOrFallback(supabase)

    const { data: rawStaff, error: staffError } = await (serviceClient as any)
      .from("staff_directory")
      .select("id, first_name, last_name, full_name, department, employment_status")
      .order("first_name", { ascending: true })

    if (staffError) {
      log.error({ err: staffError }, "Failed to fetch staff directory for assignees")
      return NextResponse.json({ error: "Failed to load assignees" }, { status: 500 })
    }

    const staffList = (rawStaff || []) as StaffDirectoryRow[]
    const assignableStaff = staffList.filter((s) =>
      isAssignableProfile(
        { employment_status: s.employment_status, department: s.department },
        { requiredDepartment: department, allowOnLeave: true }
      )
    )

    const userIds = assignableStaff.map((s) => s.id)
    const todayIso = toLocalISODate()
    const awayItems = userIds.length > 0 ? await loadAwayToday(serviceClient, todayIso, userIds) : []

    const awayMap = new Map<string, string | null>()
    for (const item of awayItems) {
      awayMap.set(item.userId, item.until ?? null)
    }

    const data = assignableStaff.map((member) => ({
      id: member.id,
      name: formatFullName(member.first_name, member.last_name) || member.full_name || "Unknown",
      on_leave_until: awayMap.get(member.id) ?? null,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in GET /api/help-desk/assignees")
    return NextResponse.json({ error: "Failed to fetch assignees" }, { status: 500 })
  }
}
