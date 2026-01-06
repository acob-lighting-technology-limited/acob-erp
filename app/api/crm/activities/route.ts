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
    const completed = searchParams.get("completed")
    const priority = searchParams.get("priority")
    const assigned_to = searchParams.get("assigned_to")
    const contact_id = searchParams.get("contact_id")
    const opportunity_id = searchParams.get("opportunity_id")
    const due_from = searchParams.get("due_from")
    const due_to = searchParams.get("due_to")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    let query = supabase
      .from("crm_activities")
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
      `,
        { count: "exact" }
      )
      .order("due_date", { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq("type", type)
    }
    if (completed !== null) {
      query = query.eq("completed", completed === "true")
    }
    if (priority) {
      query = query.eq("priority", priority)
    }
    if (assigned_to) {
      query = query.eq("assigned_to", assigned_to)
    }
    if (contact_id) {
      query = query.eq("contact_id", contact_id)
    }
    if (opportunity_id) {
      query = query.eq("opportunity_id", opportunity_id)
    }
    if (due_from) {
      query = query.gte("due_date", due_from)
    }
    if (due_to) {
      query = query.lte("due_date", due_to)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching activities:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, count, limit, offset })
  } catch (error: any) {
    console.error("Error in GET /api/crm/activities:", error)
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

    if (!body.type) {
      return NextResponse.json({ error: "Activity type is required" }, { status: 400 })
    }
    if (!body.subject) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 })
    }
    if (!body.contact_id && !body.opportunity_id) {
      return NextResponse.json({ error: "Either contact_id or opportunity_id is required" }, { status: 400 })
    }

    const activityData = {
      contact_id: body.contact_id,
      opportunity_id: body.opportunity_id,
      type: body.type,
      subject: body.subject,
      description: body.description,
      due_date: body.due_date,
      duration_minutes: body.duration_minutes,
      location: body.location,
      priority: body.priority || "normal",
      assigned_to: body.assigned_to || user.id,
      reminder_at: body.reminder_at,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from("crm_activities")
      .insert(activityData)
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
      console.error("Error creating activity:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update last_contact_date on the contact if applicable
    if (body.contact_id && ["call", "email", "meeting"].includes(body.type)) {
      await supabase
        .from("crm_contacts")
        .update({ last_contact_date: new Date().toISOString() })
        .eq("id", body.contact_id)
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error("Error in POST /api/crm/activities:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
