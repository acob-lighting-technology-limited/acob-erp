import "server-only"
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"

const log = logger("supabase-admin")

/**
 * Sync employment_status into the user's auth metadata so middleware
 * can read it from the JWT without an extra DB query on every request.
 * Call this whenever employment_status changes in the profiles table.
 */
export async function syncEmploymentStatusToAuth(userId: string, employmentStatus: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    log.error({ userId }, "Cannot sync employment status — missing service role env vars")
    return
  }
  const adminClient = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: { employment_status: employmentStatus },
  })
  if (error) {
    log.error({ err: error, userId, employmentStatus }, "Failed to sync employment status to auth metadata")
  }
}

export function getServiceRoleClientOrFallback<T = unknown>(fallback: SupabaseClient<T>): SupabaseClient<T> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fallback
  }

  return createAdminClient<T>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
