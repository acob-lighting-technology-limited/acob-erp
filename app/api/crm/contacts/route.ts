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
    const type = searchParams.get("type")
    const stage = searchParams.get("stage")
    const assigned_to = searchParams.get("assigned_to")
    const source = searchParams.get("source")
    const search = searchParams.get("search")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    let query = supabase
      .from("crm_contacts")
      .select(
        `
        *,
        assigned_user:profiles!crm_contacts_assigned_to_fkey (
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

    if (type) {
      query = query.eq("type", type)
    }
    if (stage) {
      query = query.eq("stage", stage)
    }
    if (assigned_to) {
      query = query.eq("assigned_to", assigned_to)
    }
    if (source) {
      query = query.eq("source", source)
    }
    if (search) {
      query = query.or(`contact_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching contacts:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data,
      count,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error("Error in GET /api/crm/contacts:", error)
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

    // Validate required fields
    if (!body.contact_name) {
      return NextResponse.json({ error: "Contact name is required" }, { status: 400 })
    }

    // Get default pipeline if not provided
    let pipeline_id = body.pipeline_id
    if (!pipeline_id && body.type === "lead") {
      const { data: defaultPipeline } = await supabase
        .from("crm_pipelines")
        .select("id")
        .eq("is_default", true)
        .single()

      if (defaultPipeline) {
        pipeline_id = defaultPipeline.id
      }
    }

    const contactData = {
      type: body.type || "lead",
      company_name: body.company_name,
      contact_name: body.contact_name,
      title: body.title,
      email: body.email,
      phone: body.phone,
      mobile: body.mobile,
      website: body.website,
      address: body.address || {},
      industry: body.industry,
      company_size: body.company_size,
      annual_revenue: body.annual_revenue,
      source: body.source,
      source_details: body.source_details,
      assigned_to: body.assigned_to || user.id,
      pipeline_id,
      stage: body.stage || "new",
      score: body.score || 0,
      tags: body.tags || [],
      next_follow_up: body.next_follow_up,
      notes: body.notes,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from("crm_contacts")
      .insert(contactData)
      .select(
        `
        *,
        assigned_user:profiles!crm_contacts_assigned_to_fkey (
          id,
          first_name,
          last_name
        )
      `
      )
      .single()

    if (error) {
      console.error("Error creating contact:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error("Error in POST /api/crm/contacts:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
