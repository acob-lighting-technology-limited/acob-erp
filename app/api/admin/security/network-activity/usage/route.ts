import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import { requireAccessContextV2, enforceRouteAccessV2 } from "@/lib/admin/api-guard-v2"
import { toLocalISODate } from "@/lib/utils/date"
import {
  daysInRange,
  isIsoDay,
  shiftIsoDay,
  summariseUsage,
  type UsageDailyRow,
  type UsageWanRow,
} from "@/lib/security/network-usage-report"

const log = logger("admin-security-network-usage")
export const dynamic = "force-dynamic"

const DEFAULT_RANGE_DAYS = 7
const MAX_RANGE_DAYS = 93
/** PostgREST returns at most this many rows per request. */
const PAGE_SIZE = 1000

/**
 * Data usage per login and per day for a date range — org-wide, admin-only (security.networkActivity).
 * Read with the service role: the usage tables grant nothing to browser roles.
 */
export async function GET(request: NextRequest) {
  const accessResult = await requireAccessContextV2()
  if (!accessResult.ok) return accessResult.response
  const enforceResult = enforceRouteAccessV2(accessResult.context, "security.networkActivity")
  if (!enforceResult.ok) return enforceResult.response

  const today = toLocalISODate()
  const toParam = request.nextUrl.searchParams.get("to")
  const fromParam = request.nextUrl.searchParams.get("from")
  if ((toParam && !isIsoDay(toParam)) || (fromParam && !isIsoDay(fromParam))) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 })
  }
  const to = toParam ?? today
  const from = fromParam ?? shiftIsoDay(to, -(DEFAULT_RANGE_DAYS - 1))
  const span = daysInRange(from, to)
  if (span < 1 || span > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Pick a range of 1 to ${MAX_RANGE_DAYS} days` }, { status: 400 })
  }

  const service = getServiceClient()
  if (!service) return NextResponse.json({ error: "Usage storage is not configured" }, { status: 503 })

  try {
    const rows: UsageDailyRow[] = []
    for (let start = 0; ; start += PAGE_SIZE) {
      const { data, error } = await service
        .from("network_usage_daily")
        .select("day, username, mac_address, bytes_in, bytes_out")
        .gte("day", from)
        .lte("day", to)
        .order("day")
        .order("username")
        .order("mac_address")
        .range(start, start + PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      rows.push(
        ...(data ?? []).map((r) => ({
          day: r.day as string,
          username: r.username as string,
          mac_address: (r.mac_address as string) ?? "",
          bytes_in: Number(r.bytes_in),
          bytes_out: Number(r.bytes_out),
        }))
      )
      if (!data || data.length < PAGE_SIZE) break
    }

    const { data: wan, error: wanError } = await service
      .from("network_usage_wan_daily")
      .select("day, rx_bytes, tx_bytes")
      .gte("day", from)
      .lte("day", to)
    if (wanError) throw new Error(wanError.message)
    const wanRows: UsageWanRow[] = (wan ?? []).map((r) => ({
      day: r.day as string,
      rx_bytes: Number(r.rx_bytes),
      tx_bytes: Number(r.tx_bytes),
    }))

    // staff_directory, not profiles: profiles RLS shows a caller only their own row.
    const supabase = await createClient()
    const { data: staff, error: staffError } = await supabase
      .from("staff_directory")
      .select("full_name, company_email")
      .not("company_email", "is", null)
    if (staffError) log.warn({ err: String(staffError) }, "Could not load staff names; showing logins only")
    const staffNameByLogin = new Map<string, string>()
    for (const row of staff ?? []) {
      if (row.company_email && row.full_name) {
        staffNameByLogin.set(row.company_email.trim().toLowerCase(), row.full_name)
      }
    }

    const { data: first } = await service
      .from("network_usage_daily")
      .select("day")
      .order("day", { ascending: true })
      .limit(1)

    return NextResponse.json({
      data: {
        range: { from, to },
        trackingSince: (first?.[0]?.day as string | undefined) ?? null,
        ...summariseUsage(rows, wanRows, staffNameByLogin),
      },
    })
  } catch (error) {
    log.error({ err: String(error), from, to }, "Failed to load network usage")
    return NextResponse.json({ error: "Could not load data usage" }, { status: 502 })
  }
}
