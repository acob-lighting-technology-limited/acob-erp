import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAuditRpcParams, isCriticalAuditAction, type AuditPayload } from "@/lib/audit/core"

export class AuditWriteError extends Error {
  details?: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = "AuditWriteError"
    this.details = details
  }
}

export interface WriteAuditOptions {
  critical?: boolean
  failOpen?: boolean
  logger?: (message: string, details?: unknown) => void
}

export async function writeAuditLog(
  supabase: SupabaseClient,
  payload: AuditPayload,
  options?: WriteAuditOptions
): Promise<string | null> {
  const params = buildAuditRpcParams(payload)
  const shouldFailClosed =
    options?.failOpen === true
      ? false
      : (options?.critical ?? isCriticalAuditAction(params._normalizedAction, params._event))

  const { _normalizedAction, _event, ...rpcParams } = params

  const { data, error } = await supabase.rpc("log_audit", rpcParams)

  if (error) {
    const auditError = new AuditWriteError("Failed to write audit log", error)
    if (shouldFailClosed) {
      throw auditError
    }

    const log = options?.logger || ((message: string, details?: unknown) => console.error(message, details))
    log("audit write failed (fail-open)", {
      error,
      payload: {
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
      },
    })
    return null
  }

  return typeof data === "string" ? data : null
}
