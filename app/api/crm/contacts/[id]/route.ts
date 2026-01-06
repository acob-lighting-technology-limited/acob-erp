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
      `
      )
      .eq("id", params.id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also fetch related opportunities and activities
    const [opportunitiesResult, activitiesResult] = await Promise.all([
      supabase
        .from("crm_opportunities")
        .select("*")
        .eq("contact_id", params.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("crm_activities")
        .select("*")
        .eq("contact_id", params.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ])

    return NextResponse.json({
      data: {
        ...data,
        opportunities: opportunitiesResult.data || [],
        activities: activitiesResult.data || [],
      },
    })
  } catch (error: any) {
    console.error("Error in GET /api/crm/contacts/[id]:", error)
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

    // Build update object, only include fields that are provided
    const updateData: Record<string, any> = {}
    const allowedFields = [
      "type",
      "company_name",
      "contact_name",
      "title",
      "email",
      "phone",
      "mobile",
      "website",
      "address",
      "industry",
      "company_size",
      "annual_revenue",
      "source",
      "source_details",
      "assigned_to",
      "pipeline_id",
      "stage",
      "score",
      "tags",
      "next_follow_up",
      "last_contact_date",
      "notes",
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Handle conversion to customer
    if (body.convert_to_customer && body.type !== "customer") {
      updateData.type = "customer"
      updateData.converted_to_customer_at = new Date().toISOString()
      updateData.converted_by = user.id
    }

    const { data, error } = await supabase
      .from("crm_contacts")
      .update(updateData)
      .eq("id", params.id)
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
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("Error in PUT /api/crm/contacts/[id]:", error)
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
      return NextResponse.json({ error: "Only admins can delete contacts" }, { status: 403 })
    }

    const { error } = await supabase.from("crm_contacts").delete().eq("id", params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in DELETE /api/crm/contacts/[id]:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
