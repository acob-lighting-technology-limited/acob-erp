import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase.from("crm_pipelines").select("*").order("name")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("Error in GET /api/crm/pipelines:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
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

    // Check if user is admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Only admins can create pipelines" }, { status: 403 })
    }

    const body = await request.json()

    if (!body.name) {
      return NextResponse.json({ error: "Pipeline name is required" }, { status: 400 })
    }

    // If setting as default, unset other defaults first
    if (body.is_default) {
      await supabase.from("crm_pipelines").update({ is_default: false }).eq("is_default", true)
    }

    const pipelineData = {
      name: body.name,
      description: body.description,
      stages: body.stages || [
        { name: "New", order: 1, probability: 10 },
        { name: "Qualified", order: 2, probability: 25 },
        { name: "Proposal", order: 3, probability: 50 },
        { name: "Negotiation", order: 4, probability: 75 },
        { name: "Won", order: 5, probability: 100 },
        { name: "Lost", order: 6, probability: 0 },
      ],
      is_default: body.is_default || false,
      is_active: body.is_active !== false,
      created_by: user.id,
    }

    const { data, error } = await supabase.from("crm_pipelines").insert(pipelineData).select().single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error("Error in POST /api/crm/pipelines:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
