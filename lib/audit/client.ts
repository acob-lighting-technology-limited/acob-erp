import type { SupabaseClient } from "@supabase/supabase-js"
import type { AuditPayload } from "@/lib/audit/core"
import { writeAuditLog, type WriteAuditOptions } from "@/lib/audit/write-audit"

export async function writeAuditLogClient(
  supabase: SupabaseClient,
  payload: AuditPayload,
  options?: WriteAuditOptions
): Promise<string | null> {
  return writeAuditLog(supabase, payload, options)
}
