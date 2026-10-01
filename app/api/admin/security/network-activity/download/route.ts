import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { requireAccessContextV2, enforceRouteAccessV2 } from "@/lib/admin/api-guard-v2"
import { buildDayCsv } from "@/lib/security/network-log-archive"

const log = logger("admin-security-network-activity-download")
export const dynamic = "force-dynamic"
/** A full day is ~288 batch files fetched 8 at a time. */
export const maxDuration = 60

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** One archived day as a single CSV, with staff names resolved from company email. */
export async function GET(request: NextRequest) {
  const accessResult = await requireAccessContextV2()
  if (!accessResult.ok) return accessResult.response
  const enforceResult = enforceRouteAccessV2(accessResult.context, "security.networkActivity")
  if (!enforceResult.ok) return enforceResult.response

  const date = request.nextUrl.searchParams.get("date") ?? ""
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }

  // staff_directory, not profiles: profiles RLS shows a caller only their own row.
  const supabase = await createClient()
  const { data: staff, error: staffError } = await supabase
    .from("staff_directory")
    .select("full_name, company_email")
    .not("company_email", "is", null)
  if (staffError) log.warn({ err: String(staffError) }, "Could not load staff names; exporting without them")

  const staffNameByEmail = new Map<string, string>()
  for (const row of staff ?? []) {
    if (row.company_email && row.full_name) staffNameByEmail.set(row.company_email.trim().toLowerCase(), row.full_name)
  }

  try {
    const csv = await buildDayCsv(date, staffNameByEmail)
    if (csv === null) return NextResponse.json({ error: "No logs archived for that day" }, { status: 404 })
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="network-logs-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    log.error({ err: String(error), date }, "Failed to build archived network log CSV")
    return NextResponse.json({ error: "Could not read the archive for that day" }, { status: 502 })
  }
}
