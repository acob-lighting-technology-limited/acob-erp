import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"

const log = logger("help-desk-categories")
export const dynamic = "force-dynamic"

type ErrorWithCode = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

type ProfileDepartmentRow = {
  department: string | null
}

type DepartmentRow = {
  name: string | null
}

type HelpDeskCategoryRow = {
  id: string
  service_department: string | null
  request_type: string | null
  code: string | null
  name: string | null
  description: string | null
  support_mode: string | null
  is_active: boolean
}

type LegacyHelpDeskCategoryRow = Omit<HelpDeskCategoryRow, "support_mode" | "is_active">

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const maybe = error as Record<string, unknown>
    const parts = [
      typeof maybe.message === "string" ? maybe.message : "",
      typeof maybe.details === "string" ? maybe.details : "",
      typeof maybe.hint === "string" ? maybe.hint : "",
      typeof maybe.code === "string" ? `code=${maybe.code}` : "",
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(" | ")
  }
  return "Unknown error"
}

export async function GET() {
  try {
    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [{ data: profileDepartments, error: profilesError }, { data: departmentRows, error: departmentsError }] =
      await Promise.all([
        dataClient.from("profiles").select("department").not("department", "is", null),
        dataClient.from("departments").select("name").eq("is_active", true),
      ])

    if (profilesError) throw profilesError
    if (departmentsError && (departmentsError as ErrorWithCode).code !== "42703") throw departmentsError

    let data: HelpDeskCategoryRow[] = []
    const { data: categoryRows, error: categoriesError } = await dataClient
      .from("help_desk_categories")
      .select("id, service_department, request_type, code, name, description, support_mode, is_active")
      .eq("is_active", true)
      .order("service_department")
      .order("name")

    if (!categoriesError) {
      data = (categoryRows as HelpDeskCategoryRow[] | null) || []
    } else {
      const errCode = (categoriesError as ErrorWithCode)?.code

      if (errCode === "42P01") {
        data = []
      } else if (errCode === "42703") {
        const { data: legacyRows, error: legacyError } = await dataClient
          .from("help_desk_categories")
          .select("id, service_department, request_type, code, name, description")
          .order("service_department")
          .order("name")

        if (legacyError) {
          const legacyCode = (legacyError as ErrorWithCode)?.code
          if (legacyCode !== "42P01") throw legacyError
          data = []
        } else {
          data = ((legacyRows as LegacyHelpDeskCategoryRow[] | null) || []).map((row) => ({
            ...row,
            support_mode: null,
            is_active: true,
          }))
        }
      } else {
        throw categoriesError
      }
    }

    const departments = Array.from(
      new Set(
        ((profileDepartments as ProfileDepartmentRow[] | null) || [])
          .map((row) => String(row.department || "").trim())
          .filter(Boolean)
      )
    )
    for (const row of (departmentRows as DepartmentRow[] | null) || []) {
      const name = String(row.name || "").trim()
      if (name) departments.push(name)
    }
    const uniqueDepartments = Array.from(new Set(departments)).sort()

    return NextResponse.json({ data: data || [], departments: uniqueDepartments })
  } catch (error) {
    log.error({ err: String(error) }, "Error in GET /api/help-desk/categories:")
    return NextResponse.json(
      {
        error: `Failed to fetch help desk categories: ${describeError(error)}`,
      },
      { status: 500 }
    )
  }
}
