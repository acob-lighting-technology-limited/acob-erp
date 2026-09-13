import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import {
  CONTROLLED_DOC_COLUMNS,
  resolveControlledDocActor,
  type ControlledDocActor,
  type ControlledDocDbRow,
} from "@/lib/documentation/controlled-server"

export type ControlledDocContext = {
  supabase: SupabaseClient
  db: SupabaseClient
  actor: ControlledDocActor
}

/**
 * Shared preamble for controlled-document routes: rate limit, session, and
 * the caller's permissions. Data access uses the service-role client; every
 * route authorizes against `actor` before touching a row.
 */
export async function beginControlledDocRequest(
  request: Request,
  bucket: string,
  limit = 60
): Promise<{ ok: true; ctx: ControlledDocContext } | { ok: false; response: Response }> {
  const rl = await rateLimit(`controlled-docs-${bucket}:${getClientId(request)}`, { limit, windowSec: 60 })
  if (!rl.allowed) {
    return {
      ok: false,
      response: apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429),
    }
  }

  const supabase = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401) }
  }

  const db = getServiceRoleClientOrFallback(supabase)
  const actor = await resolveControlledDocActor(db, user.id)
  if (!actor) {
    return { ok: false, response: apiError("Profile not found", ApiErrorCode.FORBIDDEN, 403) }
  }

  return { ok: true, ctx: { supabase, db, actor } }
}

export async function loadControlledDoc(db: SupabaseClient, id: string): Promise<ControlledDocDbRow | null> {
  const { data } = await db.from("controlled_documents").select(CONTROLLED_DOC_COLUMNS).eq("id", id).maybeSingle()
  return (data as ControlledDocDbRow | null) ?? null
}

export function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export function formDateOrNull(formData: FormData, key: string): string | null {
  const value = formString(formData, key)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export function formFile(formData: FormData, key: string): File | null {
  const value = formData.get(key)
  return value instanceof File ? value : null
}

export function formStringList(formData: FormData, key: string): string[] {
  const raw = formString(formData, key)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.filter((item): item is string => typeof item === "string" && item.trim() !== "")))
      : []
  } catch {
    return []
  }
}
