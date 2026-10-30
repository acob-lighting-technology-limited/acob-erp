/**
 * Attaches each recurring repeat's series frequency, for the "Repeats monthly"
 * badge. Works with any client: the service role on the server, or the
 * browser client, where the task_series select policy lets a person read the
 * series they hold.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

type SeriesLinked = { series_id?: string | null; series_frequency?: string | null }

export async function withSeriesFrequency<T extends SeriesLinked>(client: SupabaseClient, tasks: T[]): Promise<T[]> {
  const seriesIds = Array.from(new Set(tasks.map((task) => task.series_id).filter(Boolean) as string[]))
  if (seriesIds.length === 0) return tasks
  const { data } = await client.from("task_series").select("id, frequency").in("id", seriesIds)
  const frequencyById = new Map(
    ((data || []) as Array<{ id: string; frequency: string }>).map((row) => [row.id, row.frequency])
  )
  return tasks.map((task) =>
    task.series_id ? { ...task, series_frequency: frequencyById.get(task.series_id) ?? null } : task
  )
}
