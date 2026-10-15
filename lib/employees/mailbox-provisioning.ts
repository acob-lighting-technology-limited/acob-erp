import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  CpanelError,
  createMailbox,
  generateMailboxPassword,
  getMailbox,
  isCpanelConfigured,
  setMailboxPassword,
} from "@/lib/cpanel/client"
import { DEFAULT_MAILBOX_QUOTA_MB } from "@/lib/cpanel/quota"
import { logger } from "@/lib/logger"
import { ORG_STAFF_DOMAIN } from "@/lib/org-config"

const log = logger("mailbox-provisioning")

/** profiles.mailbox_status: whether Matrix managed to create the staff mailbox. */
export type MailboxStatus = "created" | "failed"

export type ProvisionResult =
  | { ok: true; password: string; created: boolean }
  | { ok: false; reason: string; manual: boolean }

/**
 * Makes sure the employee's company mailbox exists on cPanel with a fresh
 * password: created (default 1 GB quota) when missing, password reset when it
 * already exists. Records the outcome on profiles.mailbox_status so HR and ICT
 * can see failures, and never throws — onboarding must carry on without it.
 *
 * `manual: true` means Matrix cannot do this here at all (cPanel not configured,
 * or the address is not on the cPanel staff domain) — ICT handles it by hand.
 *
 * `createOnly` refuses to touch a mailbox that already exists (it is reported
 * as a failure instead of having its password reset). Approval uses it: an
 * existing address may belong to someone else.
 */
export async function provisionStaffMailbox(
  dataClient: SupabaseClient,
  params: { profileId: string; email: string; createOnly?: boolean }
): Promise<ProvisionResult> {
  const email = params.email.trim().toLowerCase()

  if (!isCpanelConfigured()) return { ok: false, reason: "cPanel is not configured on this server", manual: true }
  if (!email.endsWith(`@${ORG_STAFF_DOMAIN.toLowerCase()}`)) {
    return { ok: false, reason: `${email} is not on @${ORG_STAFF_DOMAIN}, so it is not a cPanel mailbox`, manual: true }
  }

  const password = generateMailboxPassword()
  let result: ProvisionResult
  try {
    const existing = await getMailbox(email)
    if (existing && params.createOnly) {
      result = {
        ok: false,
        reason: `A mailbox for ${email} already exists, so its password was not changed`,
        manual: false,
      }
    } else {
      if (existing) {
        await setMailboxPassword(email, password)
      } else {
        await createMailbox(email, password, DEFAULT_MAILBOX_QUOTA_MB)
      }
      result = { ok: true, password, created: !existing }
    }
  } catch (err) {
    const reason = err instanceof CpanelError ? err.message : "Unexpected error talking to cPanel"
    log.error({ err: String(err), email, profileId: params.profileId }, "Mailbox provisioning failed")
    result = { ok: false, reason, manual: false }
  }

  await recordMailboxStatus(
    dataClient,
    params.profileId,
    result.ok ? "created" : "failed",
    result.ok ? null : result.reason
  )
  return result
}

export async function recordMailboxStatus(
  dataClient: SupabaseClient,
  profileId: string,
  status: MailboxStatus,
  error: string | null
): Promise<void> {
  const { error: updateError } = await dataClient
    .from("profiles")
    .update({ mailbox_status: status, mailbox_error: error })
    .eq("id", profileId)
  if (updateError) log.error({ err: updateError.message, profileId }, "Failed to record mailbox status")
}
