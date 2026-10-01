import type { SupabaseClient } from "@supabase/supabase-js"

/** The calendar year in WAT, the year the strategic plan runs on. */
export function currentPlanYear(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric" }).format(now))
}

/**
 * Which strategic-plan year a scorecard request is about, plus every year that
 * has KPIs (for the picker).
 *
 * An explicit, known `requested` year wins. Otherwise the current year — or,
 * when its KPIs have not been loaded yet (early January), the latest year that
 * has them, so the pages show last year's scorecard instead of going empty.
 */
export async function resolvePlanYear(
  supabase: SupabaseClient,
  requested?: string | null
): Promise<{ year: number; years: number[] }> {
  const { data } = await supabase.from("corporate_kpis").select("plan_year").eq("is_archived", false)
  const years = Array.from(new Set((data || []).map((row) => Number(row.plan_year)).filter(Number.isFinite))).sort(
    (a, b) => b - a
  )

  const asked = Number(requested)
  if (requested && Number.isInteger(asked) && years.includes(asked)) return { year: asked, years }

  const current = currentPlanYear()
  if (years.includes(current) || years.length === 0) return { year: current, years }
  return { year: years.find((y) => y <= current) ?? years[0], years }
}
