import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

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
    const dataClient = getServiceRoleClientOrFallback(supabase as any)
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
    if (departmentsError && (departmentsError as any).code !== "42703") throw departmentsError

    let data: any[] = []
    const { data: categoryRows, error: categoriesError } = await dataClient
      .from("help_desk_categories")
      .select("id, service_department, request_type, code, name, description, support_mode, is_active")
      .eq("is_active", true)
      .order("service_department")
      .order("name")

    if (!categoriesError) {
      data = categoryRows || []
    } else {
      const errCode = (categoriesError as any)?.code

      if (errCode === "42P01") {
        data = []
      } else if (errCode === "42703") {
        const { data: legacyRows, error: legacyError } = await dataClient
          .from("help_desk_categories")
          .select("id, service_department, request_type, code, name, description")
          .order("service_department")
          .order("name")

        if (legacyError) {
          const legacyCode = (legacyError as any)?.code
          if (legacyCode !== "42P01") throw legacyError
          data = []
        } else {
          data = (legacyRows || []).map((row: any) => ({ ...row, support_mode: null, is_active: true }))
        }
      } else {
        throw categoriesError
      }
    }

    const departments = Array.from(
      new Set((profileDepartments || []).map((row: any) => String(row.department || "").trim()).filter(Boolean))
    )
    for (const row of departmentRows || []) {
      const name = String((row as any)?.name || "").trim()
      if (name) departments.push(name)
    }
    const uniqueDepartments = Array.from(new Set(departments)).sort()

    return NextResponse.json({ data: data || [], departments: uniqueDepartments })
  } catch (error) {
    console.error("Error in GET /api/help-desk/categories:", error)
    return NextResponse.json(
      {
        error: `Failed to fetch help desk categories: ${describeError(error)}`,
      },
      { status: 500 }
    )
  }
}
