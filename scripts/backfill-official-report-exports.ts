import "dotenv/config"
import { createClient } from "@supabase/supabase-js"
import {
  buildOfficialReportPdf,
  persistOfficialPdf,
  resolveOfficialReportExportMeta,
  tryReadStoredOfficialPdf,
  type OfficialReportExportType,
} from "@/lib/reports/official-pdf"

type WeekKey = {
  week_number: number
  year: number
}

type SelectWeekRow = {
  week_number: number | null
  year: number | null
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Missing Supabase service role environment variables")
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function getCandidateWeeks(client: ReturnType<typeof getAdminClient>) {
  const [weeklyReportsResult, weeklyTasksResult, actionItemsResult] = await Promise.all([
    client.from("weekly_reports").select("week_number, year").eq("status", "submitted").returns<SelectWeekRow[]>(),
    client.from("tasks").select("week_number, year").eq("category", "weekly_action").returns<SelectWeekRow[]>(),
    client.from("action_items").select("week_number, year").returns<SelectWeekRow[]>(),
  ])

  if (weeklyReportsResult.error) throw new Error(weeklyReportsResult.error.message)
  if (weeklyTasksResult.error) throw new Error(weeklyTasksResult.error.message)
  if (actionItemsResult.error) throw new Error(actionItemsResult.error.message)

  const weeks = new Map<string, WeekKey>()
  ;[...(weeklyReportsResult.data || []), ...(weeklyTasksResult.data || []), ...(actionItemsResult.data || [])].forEach(
    (row: SelectWeekRow) => {
      const weekNumber = Number(row.week_number || 0)
      const year = Number(row.year || 0)
      if (!weekNumber || !year) return
      weeks.set(`${year}-${weekNumber}`, { week_number: weekNumber, year })
    }
  )

  return Array.from(weeks.values()).sort((a, b) => a.year - b.year || a.week_number - b.week_number)
}

async function isLockedWeek(client: ReturnType<typeof getAdminClient>, week: number, year: number) {
  const { data, error } = await (
    client as unknown as {
      rpc: (
        fn: string,
        args: { p_week: number; p_year: number }
      ) => Promise<{ data: boolean | null; error: { message: string } | null }>
    }
  ).rpc("weekly_report_can_mutate", {
    p_week: week,
    p_year: year,
  })

  if (error) throw new Error(error.message)
  return !Boolean(data)
}

async function ensureExport(
  client: ReturnType<typeof getAdminClient>,
  week: number,
  year: number,
  type: OfficialReportExportType
) {
  const meta = await resolveOfficialReportExportMeta(client, { week, year, type })
  const existing = await tryReadStoredOfficialPdf(meta.storagePath)
  if (existing) {
    return { status: "existing", path: meta.storagePath }
  }

  const { pdfBytes, storagePath } = await buildOfficialReportPdf(client, { week, year, type })
  await persistOfficialPdf(storagePath, pdfBytes)
  return { status: "created", path: storagePath }
}

async function main() {
  const client = getAdminClient()
  const weeks = await getCandidateWeeks(client)
  const results: Array<Record<string, unknown>> = []

  for (const entry of weeks) {
    if (!(await isLockedWeek(client, entry.week_number, entry.year))) continue

    for (const type of ["weekly_report", "action_point"] as const) {
      try {
        const result = await ensureExport(client, entry.week_number, entry.year, type)
        results.push({
          week: entry.week_number,
          year: entry.year,
          type,
          status: result.status,
          path: result.path,
        })
      } catch (error) {
        results.push({
          week: entry.week_number,
          year: entry.year,
          type,
          status: "skipped",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }
  }

  console.log(JSON.stringify({ success: true, processed: results.length, results }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
