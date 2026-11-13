import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { logger } from "@/lib/logger"
import { toLocalISODate, formatWATDate } from "@/lib/utils/date"
import { addIsoDays } from "@/lib/hr/leave-days"
import { loadApprovedLeaveDates, loadHolidays } from "@/lib/hr/non-working-days"
import { nonWorkingDaysFor } from "@/lib/tasks/overdue"
import { acceptanceRespondBy, acceptanceStep } from "@/lib/assets/acceptance"
import { notifyAssetUsers } from "@/lib/assets/asset-notify"

const log = logger("cron-assets-acceptance")

export const dynamic = "force-dynamic"

/** Enough history to cover a long leave on top of the three working days. */
const LOOKBACK_DAYS = 90

type PendingRow = {
  id: string
  asset_id: string
  assigned_to: string
  created_at: string
  acceptance_reminded_at: string | null
}

/**
 * Weekday mornings: for each assignment still waiting to be confirmed, send one reminder after a
 * working day, and count it as accepted once three working days have passed (see
 * lib/assets/acceptance.ts). Weekends, public holidays and the person's approved leave do not count.
 * Idempotent: a second run the same day finds nothing new to do.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "Missing configuration" }, { status: 500 })
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const { data, error } = await db
      .from("asset_assignments")
      .select("id, asset_id, assigned_to, created_at, acceptance_reminded_at")
      .eq("acceptance_status", "pending")
      .eq("is_current", true)
      .not("assigned_to", "is", null)
    if (error) throw error
    const pending = (data ?? []) as PendingRow[]
    if (pending.length === 0) return NextResponse.json({ data: { reminded: 0, auto_accepted: 0 } })

    const today = toLocalISODate()
    const windowStart = addIsoDays(today, -LOOKBACK_DAYS)
    const [holidays, leaveByUser, assetsRes] = await Promise.all([
      loadHolidays(db, windowStart, addIsoDays(today, 30)),
      loadApprovedLeaveDates(
        db,
        Array.from(new Set(pending.map((p) => p.assigned_to))),
        windowStart,
        addIsoDays(today, 30)
      ),
      db
        .from("assets")
        .select("id, unique_code, asset_model")
        .in("id", Array.from(new Set(pending.map((p) => p.asset_id)))),
    ])
    const assets = new Map(
      ((assetsRes.data ?? []) as { id: string; unique_code: string; asset_model: string | null }[]).map((a) => [
        a.id,
        a,
      ])
    )

    let reminded = 0
    let autoAccepted = 0
    for (const row of pending) {
      const entered = toLocalISODate(new Date(row.created_at))
      const excluded = nonWorkingDaysFor(holidays, leaveByUser.get(row.assigned_to) ?? [])
      const step = acceptanceStep(entered, today, Boolean(row.acceptance_reminded_at), excluded)
      const asset = assets.get(row.asset_id)
      const label = asset
        ? asset.asset_model
          ? `${asset.unique_code} (${asset.asset_model})`
          : asset.unique_code
        : "an asset"

      if (step === "auto_accept") {
        const { error: updateError } = await db
          .from("asset_assignments")
          .update({ acceptance_status: "auto_accepted", accepted_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("acceptance_status", "pending")
        if (updateError) log.error({ err: String(updateError.message), id: row.id }, "Auto-accept failed")
        else autoAccepted += 1
      } else if (step === "remind") {
        const { error: updateError } = await db
          .from("asset_assignments")
          .update({ acceptance_reminded_at: new Date().toISOString() })
          .eq("id", row.id)
          .is("acceptance_reminded_at", null)
        if (updateError) {
          log.error({ err: String(updateError.message), id: row.id }, "Reminder stamp failed")
          continue
        }
        const by = formatWATDate(acceptanceRespondBy(entered, excluded), {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
        reminded += await notifyAssetUsers([row.assigned_to], {
          type: "asset_assigned",
          title: `Please confirm you received ${asset?.unique_code ?? "your asset"}`,
          message:
            `${label} was assigned to you. Open My Assets and tap Accept, or tell us if you didn't get it. ` +
            `If we don't hear from you by ${by}, it will be recorded as received.`,
          linkUrl: "/accounts/assets",
          entityType: "asset_assignment",
          entityId: row.id,
          priority: "high",
        })
      }
    }

    log.info({ pending: pending.length, reminded, autoAccepted }, "Asset acceptance run")
    return NextResponse.json({ data: { reminded, auto_accepted: autoAccepted } })
  } catch (err) {
    log.error({ err: String(err) }, "Asset acceptance run failed")
    return NextResponse.json({ error: "Asset acceptance run failed" }, { status: 500 })
  }
}
