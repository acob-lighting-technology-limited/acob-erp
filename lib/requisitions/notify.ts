import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { renderActionEmail } from "@/lib/email-templates/action-email"
import { logger } from "@/lib/logger"
import { resolveChannelEligibleUserIds } from "@/lib/notifications/delivery-policy"
import { sendNotificationEmailWithRetry } from "@/lib/notifications/email-gateway"
import { orgDepartmentSenderBare } from "@/lib/org-config"
import { formatNaira, requisitionSummary, stageTitle } from "./format"
import { FORM_LABELS } from "./limits"
import { STAGE_LABELS, STAGE_VERBS } from "./routing"
import { currentStage } from "./server"
import type { Requisition } from "./types"

const log = logger("requisition-notify")

/**
 * Who hears about what:
 *   next signer           in-app + email   (approval_request)
 *   payment processors    in-app + email   (approval_request) once fully signed
 *   requester             in-app           (progress, amount change, rejection, payment)
 *   bypassed signers      in-app           (their stage was skipped)
 *   admins                in-app           when the next stage has nobody assigned
 * Never throws: a failed notification must not fail the action.
 */
export type RequisitionEvent =
  | { kind: "submitted"; req: Requisition }
  | { kind: "signed"; req: Requisition; actorId: string; bypassedStageIds: string[]; amountChanged: boolean }
  | { kind: "rejected"; req: Requisition; actorId: string }
  | { kind: "payment"; req: Requisition; actorId: string; amount: number }

interface Person {
  id: string
  first_name: string | null
  full_name: string | null
  company_email: string | null
  additional_email: string | null
}

function linkFor(req: Requisition) {
  return `/accounts/requisitions/${req.id}`
}

function label(req: Requisition) {
  return `${FORM_LABELS[req.form_type]} ${req.requisition_number}`
}

async function notifyInApp(
  admin: SupabaseClient,
  userIds: string[],
  req: Requisition,
  actorId: string | null,
  n: {
    type: "approval_request" | "approval_granted" | "approval_rejected" | "system"
    title: string
    message: string
    priority?: string
  }
) {
  for (const userId of new Set(userIds)) {
    try {
      const { error } = await admin.rpc("create_notification", {
        p_user_id: userId,
        p_type: n.type,
        p_category: "approvals",
        p_title: n.title,
        p_message: n.message,
        p_priority: n.priority || "normal",
        p_link_url: linkFor(req),
        p_actor_id: actorId,
        p_entity_type: "requisition",
        p_entity_id: req.id,
      })
      if (error) log.error({ err: error.message, userId }, "Requisition notification rejected")
    } catch (err) {
      log.error({ err: String(err), userId }, "Requisition notification failed")
    }
  }
}

async function emailActionNeeded(
  admin: SupabaseClient,
  userIds: string[],
  req: Requisition,
  heading: string,
  intro: string,
  ctaLabel: string
) {
  try {
    const eligible = await resolveChannelEligibleUserIds(admin, {
      userIds: Array.from(new Set(userIds)),
      notificationKey: "approvals",
      channel: "email",
    })
    if (!eligible.length) return

    const { data: people } = await admin
      .from("profiles")
      .select("id, first_name, full_name, company_email, additional_email")
      .in("id", eligible)
      .returns<Person[]>()

    const details: Array<[string, string]> = [
      ["Reference", req.requisition_number],
      ["Form", FORM_LABELS[req.form_type]],
      ["Requested by", req.requester?.full_name || "—"],
      ["Department", req.department],
      ["Amount", formatNaira(req.amount)],
      ["For", requisitionSummary(req) || "—"],
    ]

    for (const person of people || []) {
      const to = (person.company_email || person.additional_email || "").trim()
      if (!to.includes("@")) continue
      await sendNotificationEmailWithRetry({
        from: orgDepartmentSenderBare("Accounts"),
        to: [to],
        subject: `${heading}: ${req.requisition_number} (${formatNaira(req.amount)})`,
        html: renderActionEmail({
          recipientFirstName: person.first_name || "",
          heading,
          intro,
          detailsTitle: "Requisition",
          details,
          ctaLabel,
          ctaPath: linkFor(req),
          footerLabel: "Requisitions",
        }),
      })
    }
  } catch (err) {
    log.error({ err: String(err), requisition: req.id }, "Requisition email failed")
  }
}

async function adminIds(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").in("role", ["admin", "super_admin"])
  return (data || []).map((p) => p.id as string)
}

async function processorIds(admin: SupabaseClient, req: Requisition): Promise<string[]> {
  const [{ data: listed }, { data: accountsLeads }] = await Promise.all([
    admin.from("requisition_payment_processors").select("profile_id"),
    admin.from("profiles").select("id, department, lead_departments").eq("is_department_lead", true),
  ])
  const ids = new Set<string>((listed || []).map((p) => p.profile_id as string))
  for (const lead of accountsLeads || []) {
    if (lead.department === "Accounts" || (lead.lead_departments || []).includes("Accounts")) ids.add(lead.id)
  }
  ids.delete(req.user_id)
  return Array.from(ids)
}

/** Tell the next signer (or admins, when the next stage has nobody). */
async function notifyNextSigner(admin: SupabaseClient, req: Requisition, actorId: string | null) {
  const next = currentStage(req)
  if (!next) return
  if (!next.assignee_id) {
    await notifyInApp(admin, await adminIds(admin), req, actorId, {
      type: "system",
      title: "Requisition stage has no one assigned",
      message: `${label(req)} is waiting on ${stageTitle(next)}, but nobody holds that role. Assign the stage.`,
      priority: "high",
    })
    return
  }
  const title = `${FORM_LABELS[req.form_type]} needs your signature`
  const message = `${req.requester?.full_name || "A colleague"} raised ${req.requisition_number} for ${formatNaira(req.amount)}. You are asked to ${STAGE_VERBS[next.stage_code]} it as ${next.role_label}.`
  await notifyInApp(admin, [next.assignee_id], req, actorId, {
    type: "approval_request",
    title,
    message,
    priority: "high",
  })
  await emailActionNeeded(admin, [next.assignee_id], req, title, message, "Review and sign")
}

async function notifyProcessors(admin: SupabaseClient, req: Requisition, actorId: string | null) {
  const ids = await processorIds(admin, req)
  const title = `${FORM_LABELS[req.form_type]} ready for payment`
  const message = `${req.requisition_number} for ${formatNaira(req.amount)} is fully signed and waiting to be paid.`
  await notifyInApp(admin, ids, req, actorId, { type: "approval_request", title, message, priority: "high" })
  await emailActionNeeded(admin, ids, req, title, message, "Record payment")
}

export async function notifyRequisitionEvent(admin: SupabaseClient, event: RequisitionEvent): Promise<void> {
  const { req } = event
  try {
    switch (event.kind) {
      case "submitted":
        if (req.status === "awaiting_payment") await notifyProcessors(admin, req, req.user_id)
        else await notifyNextSigner(admin, req, req.user_id)
        return

      case "signed": {
        const signer = req.stages?.find((s) => s.acted_by === event.actorId && s.state === "signed")
        const signerName = signer?.actor?.full_name || "A signer"

        if (event.bypassedStageIds.length) {
          const bypassed = (req.stages || []).filter((s) => event.bypassedStageIds.includes(s.id) && s.assignee_id)
          await notifyInApp(
            admin,
            bypassed.map((s) => s.assignee_id!),
            req,
            event.actorId,
            {
              type: "system",
              title: "Your requisition stage was bypassed",
              message: `${signerName} signed ${label(req)} ahead of your stage, so it no longer needs your signature.`,
            }
          )
        }

        if (event.amountChanged) {
          const change = req.amount_changes?.[req.amount_changes.length - 1]
          await notifyInApp(admin, [req.user_id], req, event.actorId, {
            type: "system",
            title: "Your requisition amount was changed",
            message: change
              ? `${signerName} changed ${req.requisition_number} from ${formatNaira(change.old_amount)} to ${formatNaira(change.new_amount)}: ${change.reason}`
              : `${signerName} changed the amount on ${req.requisition_number}.`,
            priority: "high",
          })
        }

        if (req.status === "awaiting_payment") {
          await notifyInApp(admin, [req.user_id], req, event.actorId, {
            type: "approval_granted",
            title: "Requisition fully signed",
            message: `${req.requisition_number} (${formatNaira(req.amount)}) is fully signed and is with Accounts for payment.`,
            priority: "high",
          })
          await notifyProcessors(admin, req, event.actorId)
        } else {
          const stageLabel = signer ? STAGE_LABELS[signer.stage_code].toLowerCase() : "signed"
          await notifyInApp(admin, [req.user_id], req, event.actorId, {
            type: "approval_granted",
            title: "Requisition moved forward",
            message: `${signerName} ${stageLabel} ${req.requisition_number}.`,
          })
          await notifyNextSigner(admin, req, event.actorId)
        }
        return
      }

      case "rejected":
        await notifyInApp(admin, [req.user_id], req, event.actorId, {
          type: "approval_rejected",
          title: "Requisition rejected",
          message: `${req.requisition_number} was rejected: ${req.rejection_reason || "no reason given"}`,
          priority: "high",
        })
        return

      case "payment":
        await notifyInApp(admin, [req.user_id], req, event.actorId, {
          type: "approval_granted",
          title: req.status === "paid" ? "Requisition paid" : "Requisition partly paid",
          message:
            req.status === "paid"
              ? `${req.requisition_number} has been paid in full (${formatNaira(req.amount)}).`
              : `${formatNaira(event.amount)} was paid on ${req.requisition_number}. ${formatNaira(req.amount_paid)} of ${formatNaira(req.amount)} paid so far.`,
          priority: "high",
        })
        return
    }
  } catch (err) {
    log.error({ err: String(err), kind: event.kind, requisition: req.id }, "Requisition notifications failed")
  }
}
