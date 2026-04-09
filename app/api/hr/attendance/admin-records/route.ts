import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"

const log = logger("hr-attendance-admin-records")

const SaveAdminAttendanceSchema = z.object({
  user_id: z.string().trim().min(1, "Employee is required"),
  date: z.string().trim().min(1, "Date is required"),
  status: z.enum(["present", "wfh", "remote", "late", "half_day", "absent"]),
  clock_in: z.string().optional().nullable(),
  clock_out: z.string().optional().nullable(),
})

type AccessProfile = {
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

function canManage(profile: AccessProfile | null | undefined) {
  const role = String(profile?.role || "").toLowerCase()
  return ["developer", "admin", "super_admin"].includes(role) || profile?.is_department_lead === true
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = SaveAdminAttendanceSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("role, department, is_department_lead, lead_departments")
      .eq("id", user.id)
      .maybeSingle<AccessProfile>()

    if (!canManage(actorProfile)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, department")
      .eq("id", parsed.data.user_id)
      .maybeSingle<{ id: string; department?: string | null }>()

    if (!targetProfile) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const role = String(actorProfile?.role || "").toLowerCase()
    const isAdminLike = ["developer", "admin", "super_admin"].includes(role)
    if (!isAdminLike) {
      const managed = Array.from(
        new Set([actorProfile?.department, ...(actorProfile?.lead_departments || [])].filter(Boolean) as string[])
      )
      if (!managed.includes(String(targetProfile.department || ""))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const { data: existing } = await supabase
      .from("attendance_records")
      .select("id, status, clock_in, clock_out")
      .eq("user_id", parsed.data.user_id)
      .eq("date", parsed.data.date)
      .maybeSingle<{ id: string; status?: string | null; clock_in?: string | null; clock_out?: string | null }>()

    const payload = {
      user_id: parsed.data.user_id,
      date: parsed.data.date,
      status: parsed.data.status,
      clock_in: parsed.data.clock_in || null,
      clock_out: parsed.data.clock_out || null,
    }

    const query = existing
      ? supabase.from("attendance_records").update(payload).eq("id", existing.id)
      : supabase.from("attendance_records").insert(payload)
    const { data: saved, error: saveError } = await query.select("*").single()

    if (saveError || !saved) {
      log.error({ err: String(saveError) }, "Failed to save attendance admin record")
      return NextResponse.json({ error: "Failed to save attendance record" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: existing ? "update" : "create",
        entityType: "attendance_record",
        entityId: saved.id,
        oldValues: existing || null,
        newValues: payload,
        context: { actorId: user.id, source: "api", route: "/api/hr/attendance/admin-records" },
      },
      { failOpen: true }
    )

    return NextResponse.json({
      data: saved,
      message: existing ? "Attendance record updated" : "Attendance record created",
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error in POST /api/hr/attendance/admin-records")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
