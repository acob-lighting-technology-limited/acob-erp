import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { normalizeDepartmentName } from "@/shared/departments"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"
const log = logger("staff-card")

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type StaffCardRow = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  company_email: string | null
  phone_number: string | null
  department: string | null
  designation: string | null
  employment_status: string | null
}

/**
 * One colleague's contact card — what opens when a staff photo is clicked. Fields are a
 * subset of `/api/directory`, which already shows every employee these for everyone.
 * No photo here: the clicked avatar already holds its signed URL, and re-signing it
 * would add a storage round-trip to every open.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`staff-card:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data, error } = await dataClient
    .from("profiles")
    .select(
      "id, first_name, last_name, full_name, company_email, phone_number, department, designation, employment_status"
    )
    .eq("id", id)
    .maybeSingle()

  if (error) {
    log.error({ err: error.message }, "Failed to load staff card")
    return NextResponse.json({ error: "Failed to load staff member" }, { status: 500 })
  }

  const row = data as StaffCardRow | null
  // People who have left are hidden from the directory, so they are hidden here too.
  if (!row || row.employment_status === "exited") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const name = row.full_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || null

  return NextResponse.json({
    data: {
      id: row.id,
      name,
      email: row.company_email,
      phone: row.phone_number,
      department: row.department ? normalizeDepartmentName(row.department) : null,
      designation: row.designation,
    },
  })
}
