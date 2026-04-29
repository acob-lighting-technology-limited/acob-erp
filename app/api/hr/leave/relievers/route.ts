import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listAssignableProfiles } from "@/lib/workforce/assignment-policy"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"

const log = logger("hr-leave-relievers")

type AssignableProfileRow = {
  id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await listAssignableProfiles(dataClient, {
      select: "id, full_name, first_name, last_name, employment_status, department",
      allowLegacyNullStatus: true,
      excludeUserId: user.id,
      orderBy: "first_name",
    })

    if (error) {
      log.error({ err: String(error) }, "Failed to fetch relievers via policy helper")
      return NextResponse.json({ error: "Failed to fetch relievers" }, { status: 500 })
    }

    let relieverRows = (data || []) as AssignableProfileRow[]

    // Safety fallback when policy helper returns no rows due schema/RLS drift.
    if (relieverRows.length === 0) {
      const { data: fallbackRows, error: fallbackError } = await dataClient
        .from("profiles")
        .select("id, full_name, first_name, last_name, employment_status")
        .or("employment_status.ilike.active,employment_status.is.null")
        .neq("id", user.id)
        .order("first_name", { ascending: true })
      if (fallbackError) {
        log.error({ err: String(fallbackError) }, "Failed to fetch relievers fallback query")
      } else {
        relieverRows = ((fallbackRows as AssignableProfileRow[] | null) || []).filter((row) => Boolean(row.id))
      }
    }

    const options = relieverRows
      .map((person) => {
        const label =
          person.full_name?.trim() || `${person.first_name || ""} ${person.last_name || ""}`.trim() || "Unnamed"
        return { value: person.id, label }
      })
      .filter((option) => Boolean(option.value))

    return NextResponse.json({ data: options })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled relievers route error")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
