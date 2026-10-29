import { NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { ORG_STAFF_DOMAIN } from "@/lib/org-config"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

const log = logger("admin-mailboxes-options-api")

interface ProfileDbRow {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  department: string | null
  company_email: string | null
}

interface ProjectDbRow {
  id: string
  project_name: string
  location: string | null
  status: string | null
}

function formatName(p: ProfileDbRow): string {
  return p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unnamed"
}

export async function GET() {
  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  if (!auth.scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const serviceClient = getServiceRoleClientOrFallback(auth.supabase)

  try {
    const [profilesResult, projectsResult] = await Promise.all([
      serviceClient
        .from("profiles")
        .select("id, full_name, first_name, last_name, department, company_email")
        .neq("employment_status", "exited")
        .order("first_name", { ascending: true }),
      serviceClient
        .from("projects")
        .select("id, project_name, location, status")
        .order("project_name", { ascending: true }),
    ])

    if (profilesResult.error) throw new Error(profilesResult.error.message)
    if (projectsResult.error) throw new Error(projectsResult.error.message)

    const employees = ((profilesResult.data ?? []) as ProfileDbRow[]).map((p) => ({
      id: p.id,
      name: formatName(p),
      department: p.department,
      companyEmail: p.company_email,
    }))

    const projects = ((projectsResult.data ?? []) as ProjectDbRow[]).map((pr) => ({
      id: pr.id,
      name: pr.project_name,
      location: pr.location,
      status: pr.status,
    }))

    return NextResponse.json({
      data: {
        employees,
        projects,
        staffDomain: ORG_STAFF_DOMAIN,
        quotaPresetsGb: [1, 2, 5, 10, 25],
        quotaPresetsMb: [250, 500, 1024, 2048, 5120],
        defaultQuotaMb: 250,
      },
    })
  } catch (err) {
    log.error({ err: String(err) }, "Failed to fetch mailbox options")
    return NextResponse.json({ error: "Failed to load options" }, { status: 500 })
  }
}
