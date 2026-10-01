import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { lookupMacVendor } from "@/lib/security/mac-vendor"
import { uploadBatch, type NetworkLogRow } from "@/lib/security/network-log-archive"

const log = logger("ingest-network-activity")

const NetworkActivityEntrySchema = z.object({
  matched_identifier: z.string().min(1),
  domain: z.string().min(1),
  source_ip: z.string().optional().nullable(),
  visited_at: z.string(),
  raw_url: z.string().optional().nullable(),
  device_hostname: z.string().optional().nullable(),
  mac_address: z.string().optional().nullable(),
  user_agent: z.string().optional().nullable(),
})

/** Sized for one 5-minute router push at peak, with headroom. */
const NetworkActivityBatchSchema = z.object({
  entries: z.array(NetworkActivityEntrySchema).min(1).max(5000),
})

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Receives MikroTik router batches and archives each one to SharePoint as a CSV.
 *
 * Deliberately makes no Supabase calls — not even the shared rate limiter, which
 * is a database RPC. The bearer secret is checked before any work is done, so an
 * unauthenticated request costs a string compare.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.NETWORK_ACTIVITY_INGEST_SECRET
  const authHeader = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret ?? ""}`
  if (!secret || !safeCompare(authHeader, expected)) {
    log.warn("Invalid or missing network activity ingest token")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let parsedJson: unknown
  try {
    parsedJson = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const result = NetworkActivityBatchSchema.safeParse(parsedJson)
  if (!result.success) {
    log.warn({ issues: result.error.issues }, "Invalid network activity batch payload")
    return NextResponse.json({ error: "Invalid batch payload" }, { status: 400 })
  }

  const rows: NetworkLogRow[] = result.data.entries.map((entry) => {
    const mac = entry.mac_address?.trim() || null
    return {
      visited_at: entry.visited_at,
      matched_identifier: entry.matched_identifier.trim().toLowerCase(),
      domain: entry.domain,
      raw_url: entry.raw_url ?? null,
      source_ip: entry.source_ip ?? null,
      device_hostname: entry.device_hostname ?? null,
      mac_address: mac,
      device_vendor: mac ? lookupMacVendor(mac) : null,
      user_agent: entry.user_agent ?? null,
    }
  })

  try {
    const path = await uploadBatch(rows)
    log.info({ archived: rows.length, path }, "Network activity batch archived")
    return NextResponse.json({ success: true, archived: rows.length })
  } catch (error) {
    log.error({ err: String(error) }, "Failed to archive network activity batch")
    return NextResponse.json({ error: "Failed to store batch" }, { status: 502 })
  }
}
