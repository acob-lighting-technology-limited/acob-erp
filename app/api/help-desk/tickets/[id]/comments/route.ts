import { NextRequest, NextResponse } from "next/server"
import { appendHelpDeskEvent, canLeadDepartment, getAuthContext, isAdminRole } from "@/lib/help-desk/server"

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("help_desk_tickets")
      .select("id, requester_id, assigned_to, service_department")
      .eq("id", params.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const canView =
      isAdminRole(profile.role) ||
      canLeadDepartment(profile, ticket.service_department) ||
      ticket.requester_id === user.id ||
      ticket.assigned_to === user.id

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("help_desk_comments")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true })

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error("Error in GET /api/help-desk/tickets/[id]/comments:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { comment, visibility } = await request.json()

    if (!comment || !String(comment).trim()) {
      return NextResponse.json({ error: "comment is required" }, { status: 400 })
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("help_desk_tickets")
      .select("*")
      .eq("id", params.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const canComment =
      isAdminRole(profile.role) ||
      canLeadDepartment(profile, ticket.service_department) ||
      ticket.requester_id === user.id ||
      ticket.assigned_to === user.id

    if (!canComment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const commentVisibility = visibility === "requester" ? "requester" : "internal"

    const { data: created, error: createError } = await supabase
      .from("help_desk_comments")
      .insert({
        ticket_id: ticket.id,
        author_id: user.id,
        comment: String(comment).trim(),
        visibility: commentVisibility,
      })
      .select("*")
      .single()

    if (createError) throw createError

    await appendHelpDeskEvent({
      ticketId: ticket.id,
      actorId: user.id,
      eventType: "comment_added",
      oldStatus: ticket.status,
      newStatus: ticket.status,
      details: { visibility: commentVisibility },
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/help-desk/tickets/[id]/comments:", error)
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 })
  }
}
