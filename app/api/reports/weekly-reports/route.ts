import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { canAccessAdminSection, normalizeDepartmentName, resolveAdminScope } from "@/lib/admin/rbac"
import { logger } from "@/lib/logger"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

const log = logger("api-reports-weekly-reports")

type ReportsClient = Awaited<ReturnType<typeof createClient>>

type WeeklyReportPayload = {
  id?: string
  user_id?: string
  department?: string
  week_number?: number
  year?: number
  work_done?: string
  tasks_new_week?: string
  challenges?: string
  status?: string
}

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignore write attempts from server component contexts.
        }
      },
    },
  })
}

async function canMutateWeek(supabase: ReportsClient, week: number, year: number) {
  const { data, error } = await supabase.rpc("weekly_report_can_mutate", {
    p_week: week,
    p_year: year,
  })

  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scope = await resolveAdminScope(supabase as ReportsClient, user.id)
    if (!scope || !canAccessAdminSection(scope, "reports")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const dataClient = getServiceRoleClientOrFallback(supabase as ReportsClient)
    const body = (await request.json()) as WeeklyReportPayload
    log.info({ body }, "Weekly report save request received")

    const department = normalizeDepartmentName(String(body.department || "").trim())
    const weekNumber = Number(body.week_number)
    const yearNumber = Number(body.year)
    const workDone = String(body.work_done || "").trim()
    const tasksNewWeek = String(body.tasks_new_week || "").trim()
    const challenges = String(body.challenges || "").trim()
    const status = String(body.status || "submitted").trim() || "submitted"
    const reportId = String(body.id || "").trim()

    if (!department || !workDone) {
      log.warn({ department, hasWorkDone: Boolean(workDone) }, "Weekly report validation failed")
      return NextResponse.json({ error: "Required: Department and Work Done" }, { status: 400 })
    }
    if (!Number.isFinite(weekNumber) || weekNumber < 1 || weekNumber > 53) {
      log.warn({ weekNumber }, "Weekly report validation failed: invalid week")
      return NextResponse.json({ error: "Week must be between 1 and 53" }, { status: 400 })
    }
    if (!Number.isFinite(yearNumber) || yearNumber < 2000 || yearNumber > 2100) {
      log.warn({ yearNumber }, "Weekly report validation failed: invalid year")
      return NextResponse.json({ error: "Year must be between 2000 and 2100" }, { status: 400 })
    }

    const isGlobalReportsEditor =
      scope.role === "developer" ||
      scope.role === "super_admin" ||
      (scope.role === "admin" && Array.isArray(scope.adminDomains) && scope.adminDomains.includes("reports"))

    if (!isGlobalReportsEditor && !scope.managedDepartments.includes(department)) {
      log.warn(
        { department, managedDepartments: scope.managedDepartments, userId: user.id, role: scope.role },
        "Weekly report save forbidden by department scope"
      )
      return NextResponse.json({ error: "You cannot manage reports for this department" }, { status: 403 })
    }

    const { data: existingByKey, error: existingByKeyError } = await dataClient
      .from("weekly_reports")
      .select("id, user_id, department, week_number, year")
      .eq("department", department)
      .eq("week_number", weekNumber)
      .eq("year", yearNumber)
      .maybeSingle()

    if (existingByKeyError) {
      log.error({ err: existingByKeyError, department, weekNumber, yearNumber }, "Failed to look up existing report")
      return NextResponse.json({ error: existingByKeyError.message }, { status: 500 })
    }

    const targetExisting =
      reportId && existingByKey?.id && existingByKey.id !== reportId ? existingByKey : existingByKey
    const isWeekMutable = await canMutateWeek(dataClient as ReportsClient, weekNumber, yearNumber)
    log.info(
      {
        userId: user.id,
        role: scope.role,
        department,
        weekNumber,
        yearNumber,
        reportId,
        existingId: targetExisting?.id || null,
        existingUserId: targetExisting?.user_id || null,
        isWeekMutable,
        isGlobalReportsEditor,
      },
      "Weekly report save pre-write state"
    )

    if (!isWeekMutable && targetExisting?.id) {
      log.warn(
        { department, weekNumber, yearNumber, existingId: targetExisting.id },
        "Weekly report save blocked because locked week already has report"
      )
      return NextResponse.json(
        {
          error:
            "This report already exists and the grace window has closed. Only missing reports can still be created.",
        },
        { status: 409 }
      )
    }

    if (!isGlobalReportsEditor && targetExisting?.user_id && targetExisting.user_id !== user.id) {
      log.warn(
        { userId: user.id, existingUserId: targetExisting.user_id, department, weekNumber, yearNumber },
        "Weekly report save blocked because user does not own existing report"
      )
      return NextResponse.json({ error: "You can only edit reports you created" }, { status: 403 })
    }

    const payload = {
      user_id: targetExisting?.user_id || user.id,
      department,
      week_number: weekNumber,
      year: yearNumber,
      work_done: workDone,
      tasks_new_week: tasksNewWeek,
      challenges,
      status,
    }
    log.info({ payload, writeMode: targetExisting?.id ? "update" : "insert" }, "Weekly report write payload prepared")

    const writeQuery = targetExisting?.id
      ? dataClient.from("weekly_reports").update(payload).eq("id", targetExisting.id)
      : dataClient.from("weekly_reports").insert(payload)

    const { data: saved, error: saveError } = await writeQuery.select("id").single()
    if (saveError) {
      log.error(
        {
          err: saveError,
          payload,
          writeMode: targetExisting?.id ? "update" : "insert",
          existingId: targetExisting?.id || null,
        },
        "Weekly report database write failed"
      )
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }

    log.info({ savedId: saved?.id, payload }, "Weekly report saved successfully")
    return NextResponse.json({ data: saved }, { status: targetExisting?.id ? 200 : 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error"
    log.error({ err: String(error) }, "POST /api/reports/weekly-reports failed")
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
