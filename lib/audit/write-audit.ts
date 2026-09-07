import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAuditRpcParams, isCriticalAuditAction, type AuditPayload } from "@/lib/audit/core"
import { getAuditRequestContext } from "@/lib/audit/request-context"

import { logger } from "@/lib/logger"

const log = logger("lib-audit-write-audit")

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
  // Callers rarely have the request to hand, so IP/user-agent are filled from
  // the ambient request here. An explicit value on the payload always wins.
  const requestContext = await getAuditRequestContext()
  const enrichedPayload: AuditPayload = {
    ...payload,
    context: {
      ...payload.context,
      ipAddress: payload.context.ipAddress ?? requestContext.ipAddress,
      userAgent: payload.context.userAgent ?? requestContext.userAgent,
    },
  }

  const params = buildAuditRpcParams(enrichedPayload)
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

    const fallbackLog = options?.logger || ((message: string, details?: unknown) => log.error(message, details))
    fallbackLog("audit write failed (fail-open)", {
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
