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
      .from("crm_activities")
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
        opportunity:crm_opportunities (
          id,
          name,
          value
        ),
        assigned_user:profiles!crm_activities_assigned_to_fkey (
          id,
          first_name,
          last_name
        )
      `
      )
      .eq("id", params.id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Activity not found" }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("Error in GET /api/crm/activities/[id]:", error)
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
      "opportunity_id",
      "type",
      "subject",
      "description",
      "due_date",
      "duration_minutes",
      "location",
      "completed",
      "completed_at",
      "outcome",
      "priority",
      "assigned_to",
      "reminder_at",
      "reminder_sent",
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Auto-set completed_at when marking as complete
    if (body.completed === true && !body.completed_at) {
      updateData.completed_at = new Date().toISOString()
    }
    if (body.completed === false) {
      updateData.completed_at = null
    }

    const { data, error } = await supabase
      .from("crm_activities")
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
        opportunity:crm_opportunities (
          id,
          name
        ),
        assigned_user:profiles!crm_activities_assigned_to_fkey (
          id,
          first_name,
          last_name
        )
      `
      )
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Activity not found" }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("Error in PUT /api/crm/activities/[id]:", error)
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

    const { error } = await supabase.from("crm_activities").delete().eq("id", params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in DELETE /api/crm/activities/[id]:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
