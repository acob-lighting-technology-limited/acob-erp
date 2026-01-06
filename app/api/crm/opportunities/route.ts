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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const stage = searchParams.get("stage")
    const pipeline_id = searchParams.get("pipeline_id")
    const assigned_to = searchParams.get("assigned_to")
    const contact_id = searchParams.get("contact_id")
    const search = searchParams.get("search")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    let query = supabase
      .from("crm_opportunities")
      .select(
        `
        *,
        contact:crm_contacts (
          id,
          contact_name,
          company_name,
          email
        ),
        assigned_user:profiles!crm_opportunities_assigned_to_fkey (
          id,
          first_name,
          last_name
        ),
        pipeline:crm_pipelines (
          id,
          name,
          stages
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq("status", status)
    }
    if (stage) {
      query = query.eq("stage", stage)
    }
    if (pipeline_id) {
      query = query.eq("pipeline_id", pipeline_id)
    }
    if (assigned_to) {
      query = query.eq("assigned_to", assigned_to)
    }
    if (contact_id) {
      query = query.eq("contact_id", contact_id)
    }
    if (search) {
      query = query.ilike("name", `%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching opportunities:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, count, limit, offset })
  } catch (error: any) {
    console.error("Error in GET /api/crm/opportunities:", error)
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

    const body = await request.json()

    if (!body.name) {
      return NextResponse.json({ error: "Opportunity name is required" }, { status: 400 })
    }

    // Get default pipeline if not provided
    let pipeline_id = body.pipeline_id
    if (!pipeline_id) {
      const { data: defaultPipeline } = await supabase
        .from("crm_pipelines")
        .select("id")
        .eq("is_default", true)
        .single()

      if (defaultPipeline) {
        pipeline_id = defaultPipeline.id
      }
    }

    const opportunityData = {
      contact_id: body.contact_id,
      name: body.name,
      description: body.description,
      value: body.value || 0,
      currency: body.currency || "NGN",
      probability: body.probability || 50,
      pipeline_id,
      stage: body.stage || "qualification",
      expected_close: body.expected_close,
      assigned_to: body.assigned_to || user.id,
      tags: body.tags || [],
      notes: body.notes,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from("crm_opportunities")
      .insert(opportunityData)
      .select(
        `
        *,
        contact:crm_contacts (
          id,
          contact_name,
          company_name
        ),
        assigned_user:profiles!crm_opportunities_assigned_to_fkey (
          id,
          first_name,
          last_name
        )
      `
      )
      .single()

    if (error) {
      console.error("Error creating opportunity:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error("Error in POST /api/crm/opportunities:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
