/**
 * One-off backfill of Starlink billing emails from the ict mailbox into each
 * kit's payment — the same sync the hourly cron runs, over a longer window.
 *
 *   npx tsx scripts/backfill-starlink-billing.ts --since 2026-01-01 --dry-run
 *   npx tsx scripts/backfill-starlink-billing.ts --since 2026-01-01
 */
import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { syncStarlinkBilling } from "@/lib/starlink/billing-sync"

dotenv.config({ path: ".env.local" })
dotenv.config()

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

  const since = argValue("--since") || "2026-01-01"
  const dryRun = process.argv.includes("--dry-run")
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const summary = await syncStarlinkBilling(supabase, { since, dryRun })
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`)
  process.exit(1)
})
