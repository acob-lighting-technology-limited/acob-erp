import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import {
  buildAssetMailRoutingRows,
  getProfileDisplayName,
  resolveAssetMailSpecialRecipients,
  type AssetMailRoutingProfile,
} from "@/lib/asset-mail-routing"
import { applyAssignableStatusFilter } from "@/lib/workforce/assignment-policy"
import { logger } from "@/lib/logger"

const log = logger("dev-asset-mail-routing")

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "developer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: profiles, error } = await applyAssignableStatusFilter(
      supabase
        .from("profiles")
        .select(
          "id, full_name, first_name, last_name, company_email, department, is_department_lead, lead_departments, employment_status"
        )
        .order("department", { ascending: true })
        .order("full_name", { ascending: true }),
      { allowLegacyNullStatus: false }
    )

    if (error) {
      return NextResponse.json({ error: `Failed to load profiles: ${error.message}` }, { status: 500 })
    }

    const typedProfiles = (profiles || []) as AssetMailRoutingProfile[]
    const routingRows = buildAssetMailRoutingRows(typedProfiles)
    const specialRecipients = resolveAssetMailSpecialRecipients(typedProfiles)

    return NextResponse.json({
      rows: routingRows,
      total: routingRows.length,
      hcs: specialRecipients.hcs
        ? { id: specialRecipients.hcs.id, name: getProfileDisplayName(specialRecipients.hcs) }
        : null,
      md: specialRecipients.md
        ? { id: specialRecipients.md.id, name: getProfileDisplayName(specialRecipients.md) }
        : null,
      mail_types: [
        "asset_assigned",
        "asset_transfer_outgoing",
        "asset_transfer_incoming",
        "asset_returned",
        "asset_status_alert",
      ],
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error in GET /api/dev/asset-mail-routing:")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
