import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  CpanelError,
  addForwarder,
  deleteForwarder,
  getMailbox,
  isCpanelConfigured,
  listForwardTargets,
  setMailboxLoginSuspended,
} from "@/lib/cpanel/client"
import { logger } from "@/lib/logger"
import { resolveDepartmentLeadEmails } from "@/lib/onboarding/recipients"
import { ORG_STAFF_DOMAIN } from "@/lib/org-config"
import type { EmployeeMailboxActions, EmployeeMailboxState } from "./mailbox-state"

const log = logger("mailbox-offboarding")

/**
 * The employee's cPanel mailbox as the Change Status dialog needs it: whether
 * it exists, whether login is suspended, where it forwards, and a suggested
 * forward target (their department lead) for an exit.
 */
export async function loadEmployeeMailboxState(
  dataClient: SupabaseClient,
  profileId: string
): Promise<EmployeeMailboxState> {
  const { data: profile } = await dataClient
    .from("profiles")
    .select("company_email, department")
    .eq("id", profileId)
    .maybeSingle<{ company_email: string | null; department: string | null }>()

  const email = profile?.company_email?.trim().toLowerCase() ?? null
  const base: EmployeeMailboxState = {
    email,
    managed: false,
    exists: false,
    suspendedLogin: false,
    forwards: [],
    suggestedForward: null,
    error: null,
  }
  if (!email) return base
  if (!isCpanelConfigured() || !email.endsWith(`@${ORG_STAFF_DOMAIN.toLowerCase()}`)) return base

  try {
    const [mailbox, forwards, leadEmails] = await Promise.all([
      getMailbox(email),
      listForwardTargets(email),
      profile?.department
        ? resolveDepartmentLeadEmails(dataClient, profile.department).catch(() => [] as string[])
        : Promise.resolve([] as string[]),
    ])
    return {
      ...base,
      managed: true,
      exists: Boolean(mailbox),
      suspendedLogin: mailbox?.suspendedLogin ?? false,
      forwards,
      suggestedForward: leadEmails.find((e) => e !== email) ?? null,
    }
  } catch (err) {
    log.error({ err: String(err), profileId }, "Failed to read mailbox state")
    return { ...base, managed: true, error: err instanceof CpanelError ? err.message : "Could not reach cPanel" }
  }
}

export interface MailboxActionResult {
  done: string[]
  errors: string[]
}

/**
 * Applies the mailbox steps an admin confirmed in the Change Status dialog.
 * Each step is independent and never throws — the status change itself has
 * already been saved, so a cPanel hiccup is reported, not rolled back.
 */
export async function applyEmployeeMailboxActions(
  email: string,
  actions: EmployeeMailboxActions
): Promise<MailboxActionResult> {
  const result: MailboxActionResult = { done: [], errors: [] }
  const run = async (label: string, step: () => Promise<void>) => {
    try {
      await step()
      result.done.push(label)
    } catch (err) {
      const reason = err instanceof CpanelError ? err.message : String(err)
      log.error({ err: reason, email, step: label }, "Mailbox step failed")
      result.errors.push(`${label}: ${reason}`)
    }
  }

  if (actions.suspendLogin) await run("Mailbox login suspended", () => setMailboxLoginSuspended(email, true))
  if (actions.restoreLogin) await run("Mailbox login restored", () => setMailboxLoginSuspended(email, false))
  if (actions.forwardTo) {
    const target = actions.forwardTo
    await run(`Mail forwarded to ${target}`, () => addForwarder(email, target))
  }
  for (const target of actions.removeForwards ?? []) {
    await run(`Forward to ${target} removed`, () => deleteForwarder(email, target))
  }
  return result
}
