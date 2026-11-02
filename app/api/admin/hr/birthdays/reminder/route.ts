import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getScopedDepartments, requireApiAdminScope } from "@/lib/admin/api-scope"
import { canAccessAdminSection } from "@/lib/admin/rbac"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { serverError } from "@/lib/api/errors"
import { BIRTHDAY_REMINDER_SETTINGS_KEY, parseBirthdayReminderConfig } from "@/lib/hr/birthday-reminder"

const log = logger("hr-birthday-reminder-config")

const PatchSchema = z.object({
  enabled: z.boolean(),
  recipientUserIds: z.array(z.string().uuid()).max(100),
  externalEmails: z.array(z.string().trim().toLowerCase().email()).max(50),
})

/**
 * The weekly birthday reminder is one company-wide setting, so only HR admins
 * with an unscoped view (not a single department's lead) may read or change it.
 */
async function requireGlobalHrAdmin(request: NextRequest) {
  const rl = await rateLimit(`hr-birthday-reminder:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 }),
    }
  }
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult
  const { scope, supabase } = scopeResult
  if (!canAccessAdminSection(scope, "hr") || getScopedDepartments(scope) !== null) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true as const, supabase, dataClient: getServiceRoleClientOrFallback(supabase) }
}

export async function GET(request: NextRequest) {
  const access = await requireGlobalHrAdmin(request)
  if (!access.ok) return access.response

  const { data, error } = await access.dataClient
    .from("system_settings")
    .select("value")
    .eq("key", BIRTHDAY_REMINDER_SETTINGS_KEY)
    .maybeSingle()
  if (error) return serverError(log, error)

  const { enabled, recipientUserIds, externalEmails, lastSentWeek } = parseBirthdayReminderConfig(data?.value)
  return NextResponse.json({ data: { enabled, recipientUserIds, externalEmails, lastSentWeek: lastSentWeek ?? null } })
}

export async function PATCH(request: NextRequest) {
  const access = await requireGlobalHrAdmin(request)
  if (!access.ok) return access.response

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const {
    data: { user },
  } = await access.supabase.auth.getUser()

  // Keep the send bookkeeping, so editing recipients mid-week cannot trigger a second email.
  const { data: existing } = await access.dataClient
    .from("system_settings")
    .select("value")
    .eq("key", BIRTHDAY_REMINDER_SETTINGS_KEY)
    .maybeSingle()
  const { lastSentWeek } = parseBirthdayReminderConfig(existing?.value)

  const { error } = await access.dataClient.from("system_settings").upsert(
    {
      key: BIRTHDAY_REMINDER_SETTINGS_KEY,
      value: {
        enabled: parsed.data.enabled,
        recipientUserIds: Array.from(new Set(parsed.data.recipientUserIds)),
        externalEmails: Array.from(new Set(parsed.data.externalEmails)),
        ...(lastSentWeek && { lastSentWeek }),
      },
      description: "Recipients and on/off switch for the Monday email listing the week's birthdays",
      updated_by: user?.id ?? null,
    },
    { onConflict: "key" }
  )
  if (error) return serverError(log, error)
  return NextResponse.json({ success: true })
}
