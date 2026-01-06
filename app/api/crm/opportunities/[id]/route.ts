import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("crm_opportunities")
      .select(
        `
        *,
        contact:crm_contacts (
          id,
          contact_name,
          company_name,
          email,
          phone
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
      `
      )
      .eq("id", params.id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch related activities
    const { data: activities } = await supabase
      .from("crm_activities")
      .select("*")
      .eq("opportunity_id", params.id)
      .order("created_at", { ascending: false })
      .limit(20)

    return NextResponse.json({
      data: {
        ...data,
        activities: activities || [],
      },
    })
  } catch (error: any) {
    console.error("Error in GET /api/crm/opportunities/[id]:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    const updateData: Record<string, any> = {}
    const allowedFields = [
      "contact_id",
      "name",
      "description",
      "value",
      "currency",
      "probability",
      "pipeline_id",
      "stage",
      "expected_close",
      "actual_close_date",
      "assigned_to",
      "status",
      "won_date",
      "lost_date",
      "lost_reason",
      "competitor",
      "tags",
      "notes",
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Handle status changes
    if (body.status === "won" && !body.won_date) {
      updateData.won_date = new Date().toISOString()
      updateData.actual_close_date = new Date().toISOString().split("T")[0]
    }
    if (body.status === "lost" && !body.lost_date) {
      updateData.lost_date = new Date().toISOString()
      updateData.actual_close_date = new Date().toISOString().split("T")[0]
    }

    const { data, error } = await supabase
      .from("crm_opportunities")
      .update(updateData)
      .eq("id", params.id)
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
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("Error in PUT /api/crm/opportunities/[id]:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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
      return NextResponse.json({ error: "Only admins can delete opportunities" }, { status: 403 })
    }

    const { error } = await supabase.from("crm_opportunities").delete().eq("id", params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in DELETE /api/crm/opportunities/[id]:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
