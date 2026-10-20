import { NextRequest, NextResponse } from "next/server"
import { ProjectInputSchema, parseCapacity } from "@/lib/projects/schemas"
import { parseJsonBody } from "@/lib/api/parse-body"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { serverError } from "@/lib/api/errors"

export const dynamic = "force-dynamic"
const log = logger("projects-detail-api")

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const parsed = await parseJsonBody(request, ProjectInputSchema)
    if (!parsed.ok) return parsed.response
    const {
      project_name,
      location,
      deployment_start_date,
      deployment_end_date,
      capacity_w,
      technology_type,
      project_manager_id,
      description,
      status,
      portfolio_id,
      priority,
    } = parsed.data

    const { data, error } = await supabase
      .from("projects")
      .update({
        project_name,
        location,
        deployment_start_date,
        deployment_end_date,
        capacity_w: parseCapacity(capacity_w),
        technology_type,
        project_manager_id: project_manager_id || null,
        portfolio_id: portfolio_id || null,
        description,
        status,
        updated_at: new Date().toISOString(),
        ...(priority !== undefined ? { priority } : {}),
      })
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      log.error({ err: error.message }, "Failed to update project")
      return serverError(log, error, "The request could not be completed")
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    log.error({ err }, "Unexpected error in project PUT")
    return serverError(log, err, "Internal server error")
  }
}
