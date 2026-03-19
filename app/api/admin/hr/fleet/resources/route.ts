import { NextRequest, NextResponse } from "next/server"
import { canManageFleet } from "@/lib/fleet-booking"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"

type FleetResourcePatch = Record<string, string | boolean | null>

export async function GET() {
  try {
    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowed = await canManageFleet(supabase, user.id)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data, error } = await dataClient
      .from("fleet_resources")
      .select("id, name, resource_type, description, is_active, created_at, updated_at")
      .order("name")

    if (error) return NextResponse.json({ error: error.message || "Failed to load resources" }, { status: 500 })

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowed = await canManageFleet(supabase, user.id)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const name = String(body?.name || "").trim()
    const resourceType = String(body?.resource_type || "general").trim() || "general"
    const description = String(body?.description || "").trim() || null

    if (name.length < 2) {
      return NextResponse.json({ error: "Resource name must be at least 2 characters" }, { status: 400 })
    }

    const { data, error } = await dataClient
      .from("fleet_resources")
      .insert({
        name,
        resource_type: resourceType,
        description,
        is_active: true,
        created_by: user.id,
      })
      .select("id, name, resource_type, description, is_active, created_at, updated_at")
      .single()

    if (error) {
      const status = String(error.message || "")
        .toLowerCase()
        .includes("unique")
        ? 409
        : 500
      return NextResponse.json({ error: error.message || "Failed to create resource" }, { status })
    }

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "fleet_resource",
        entityId: data.id,
        newValues: { name, resource_type: resourceType },
        context: { actorId: user.id, source: "api", route: "/api/admin/hr/fleet/resources" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowed = await canManageFleet(supabase, user.id)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const id = String(body?.id || "").trim()

    if (!id) {
      return NextResponse.json({ error: "Resource id is required" }, { status: 400 })
    }

    const patch: FleetResourcePatch = {}
    if (body?.name !== undefined) {
      const name = String(body.name || "").trim()
      if (name.length < 2) return NextResponse.json({ error: "Invalid resource name" }, { status: 400 })
      patch.name = name
    }
    if (body?.resource_type !== undefined) {
      patch.resource_type = String(body.resource_type || "general").trim() || "general"
    }
    if (body?.description !== undefined) {
      const desc = String(body.description || "").trim()
      patch.description = desc || null
    }
    if (body?.is_active !== undefined) {
      patch.is_active = Boolean(body.is_active)
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 })
    }

    const { data, error } = await dataClient
      .from("fleet_resources")
      .update(patch)
      .eq("id", id)
      .select("id, name, resource_type, description, is_active, created_at, updated_at")
      .single()

    if (error) return NextResponse.json({ error: error.message || "Failed to update resource" }, { status: 500 })

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "fleet_resource",
        entityId: id,
        newValues: patch,
        context: { actorId: user.id, source: "api", route: "/api/admin/hr/fleet/resources" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
