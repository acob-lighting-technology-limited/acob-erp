import "server-only"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { logger } from "@/lib/logger"
import { SigningError } from "./server"

const log = logger("approval-signing-route")

/** The signed-in user plus the service-role client the signing helpers need. */
export async function requireSigningUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401) } as const
  return { user, supabase, admin: getServiceRoleClientOrFallback(supabase) } as const
}

/** Maps a signing failure to its response; anything unexpected is a logged 500. */
export function signingErrorResponse(err: unknown, context: string) {
  if (err instanceof SigningError) {
    const code =
      err.status === 401 || err.status === 403
        ? ApiErrorCode.FORBIDDEN
        : err.status === 429 || err.status === 423
          ? ApiErrorCode.RATE_LIMITED
          : ApiErrorCode.VALIDATION_ERROR
    return NextResponse.json({ error: err.message, code, reason: err.code }, { status: err.status })
  }
  log.error({ err: String(err) }, context)
  return apiError("Something went wrong. Try again.", ApiErrorCode.INTERNAL_ERROR, 500)
}
