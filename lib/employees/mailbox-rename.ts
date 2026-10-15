import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  CpanelError,
  addForwarder,
  createMailbox,
  generateMailboxPassword,
  getMailbox,
  isCpanelConfigured,
  setMailboxLoginSuspended,
} from "@/lib/cpanel/client"
import { DEFAULT_MAILBOX_QUOTA_MB } from "@/lib/cpanel/quota"
import { logger } from "@/lib/logger"
import { ORG_STAFF_DOMAIN } from "@/lib/org-config"
import { recordMailboxStatus } from "./mailbox-provisioning"
import type { MailboxRenameOptions, MailboxRenameResult } from "./mailbox-rename-types"

const log = logger("mailbox-rename")
const MB = 1024 * 1024

function isStaffDomain(email: string): boolean {
  return email.endsWith(`@${ORG_STAFF_DOMAIN.toLowerCase()}`)
}

/**
 * cPanel cannot rename a mailbox, so a company email change becomes: create the
 * new mailbox (same quota as the old one, or the default), forward the old
 * address to it, and optionally suspend login to the old one. The old mailbox
 * and its mail are never deleted. Runs only when an admin confirms it in the
 * email-change dialog.
 */
export async function renameStaffMailbox(
  dataClient: SupabaseClient,
  params: { profileId: string; oldEmail: string; newEmail: string; options: MailboxRenameOptions }
): Promise<MailboxRenameResult> {
  const oldEmail = params.oldEmail.trim().toLowerCase()
  const newEmail = params.newEmail.trim().toLowerCase()
  const result: MailboxRenameResult = { password: null, done: [], errors: [] }

  if (!isCpanelConfigured()) {
    result.errors.push("cPanel is not configured on this server")
    return result
  }
  if (!isStaffDomain(newEmail)) {
    result.errors.push(`${newEmail} is not on @${ORG_STAFF_DOMAIN}, so no cPanel mailbox was created`)
    return result
  }

  let oldMailbox = null
  try {
    oldMailbox = isStaffDomain(oldEmail) ? await getMailbox(oldEmail) : null
    const existing = await getMailbox(newEmail)
    if (existing) {
      result.done.push(`${newEmail} already exists on cPanel — left as it is`)
    } else {
      const quotaMb = oldMailbox?.quotaBytes ? Math.round(oldMailbox.quotaBytes / MB) : DEFAULT_MAILBOX_QUOTA_MB
      const password = generateMailboxPassword()
      await createMailbox(newEmail, password, quotaMb)
      result.password = password
      result.done.push(`Mailbox ${newEmail} created`)
    }
    await recordMailboxStatus(dataClient, params.profileId, "created", null)
  } catch (err) {
    const reason = err instanceof CpanelError ? err.message : "Unexpected error talking to cPanel"
    log.error({ err: String(err), newEmail }, "Creating renamed mailbox failed")
    result.errors.push(`Creating ${newEmail}: ${reason}`)
    await recordMailboxStatus(dataClient, params.profileId, "failed", reason)
    return result
  }

  if (oldMailbox && params.options.forwardOld) {
    try {
      await addForwarder(oldEmail, newEmail)
      result.done.push(`Mail to ${oldEmail} now forwards to ${newEmail}`)
    } catch (err) {
      result.errors.push(`Forwarding ${oldEmail}: ${err instanceof CpanelError ? err.message : String(err)}`)
    }
  }
  if (oldMailbox && params.options.suspendOldLogin && !oldMailbox.suspendedLogin) {
    try {
      await setMailboxLoginSuspended(oldEmail, true)
      result.done.push(`Login to ${oldEmail} suspended`)
    } catch (err) {
      result.errors.push(`Suspending ${oldEmail}: ${err instanceof CpanelError ? err.message : String(err)}`)
    }
  }
  return result
}
