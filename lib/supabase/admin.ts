import "server-only"
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js"

export function getServiceRoleClientOrFallback<T = any>(fallback: SupabaseClient<T>): SupabaseClient<T> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fallback
  }

  return createAdminClient<T>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
