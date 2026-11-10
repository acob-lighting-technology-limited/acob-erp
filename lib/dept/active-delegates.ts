import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * People who hold a live department delegation (not withdrawn, not past its end date), with the
 * latest end date when they hold more than one. Used to mark them on the employee list.
 */
export async function loadActiveDelegates(client: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await client
    .from("dept_delegations")
    .select("delegate_id, valid_until")
    .is("revoked_at", null)
    .gt("valid_until", new Date().toISOString())
    .returns<Array<{ delegate_id: string; valid_until: string }>>()

  const until = new Map<string, string>()
  for (const row of data ?? []) {
    const current = until.get(row.delegate_id)
    if (!current || row.valid_until > current) until.set(row.delegate_id, row.valid_until)
  }
  return until
}
