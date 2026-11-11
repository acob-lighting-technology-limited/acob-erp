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
 *   requester             in-app           (progress, amount change)
 *   requester             in-app + email   (rejection, payment)
 *   bypassed signers      in-app           (their stage was skipped)
 *   admins                in-app           when the next stage has nobody assigned
 * Never throws: a failed notification must not fail the action.
 */
export type RequisitionEvent =
  | { kind: "submitted"; req: Requisition }
  | { kind: "signed"; req: Requisition; actorId: string; bypassedStageIds: string[]; amountChanged: boolean }
  | { kind: "rejected"; req: Requisition; actorId: string }
  | { kind: "payment"; req: Requisition; actorId: string; amount: number }
  | { kind: "unpaid"; req: Requisition; actorId: string; note: string; scheduleNumber: string }

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

/** The payment officers chosen for this requisition's form, except the person who raised it. */
async function processorIds(admin: SupabaseClient, req: Requisition): Promise<string[]> {
  const { data: listed } = await admin
    .from("requisition_payment_processors")
    .select("profile_id")
    .eq("form_type", req.form_type)
  return (listed || []).map((p) => p.profile_id as string).filter((id) => id !== req.user_id)
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

function paidInFull(req: Requisition) {
  return req.status === "paid" || req.status === "awaiting_approval"
}

/** The requester and everyone who signed: the people who follow a payment up. */
function partiesOf(req: Requisition): string[] {
  const signers = (req.stages || []).map((s) => s.acted_by).filter((id): id is string => Boolean(id))
  return Array.from(new Set([req.user_id, ...signers]))
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

        if (req.status === "paid") {
          // The MD's Approved signature on a Payment Request already paid: it is closed.
          await notifyInApp(admin, [req.user_id], req, event.actorId, {
            type: "approval_granted",
            title: "Requisition approved",
            message: `${signerName} approved ${req.requisition_number}. It is paid and closed.`,
          })
        } else if (req.status === "awaiting_payment") {
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
        await emailActionNeeded(
          admin,
          [req.user_id],
          req,
          "Requisition rejected",
          `Your ${label(req)} was rejected. Reason: ${req.rejection_reason || "no reason given"}`,
          "Open requisition"
        )
        return

      case "unpaid": {
        const message = `${req.requisition_number} was not paid on schedule ${event.scheduleNumber}: ${event.note}. It goes back to Accounts for the next schedule.`
        await notifyInApp(admin, partiesOf(req), req, event.actorId, {
          type: "system",
          title: "Requisition not paid",
          message,
          priority: "high",
        })
        await emailActionNeeded(admin, partiesOf(req), req, "Requisition not paid", message, "Open requisition")
        return
      }

      case "payment":
        await notifyInApp(admin, [req.user_id], req, event.actorId, {
          type: "approval_granted",
          title: paidInFull(req) ? "Requisition paid" : "Requisition partly paid",
          message: paidInFull(req)
            ? `${req.requisition_number} has been paid in full (${formatNaira(req.amount)}).`
            : `${formatNaira(event.amount)} was paid on ${req.requisition_number}. ${formatNaira(req.amount_paid)} of ${formatNaira(req.amount)} paid so far.`,
          priority: "high",
        })
        await emailActionNeeded(
          admin,
          [req.user_id],
          req,
          paidInFull(req) ? "Requisition paid" : "Requisition partly paid",
          paidInFull(req)
            ? `Your ${label(req)} has been paid in full (${formatNaira(req.amount)}).`
            : `${formatNaira(event.amount)} was paid on your ${label(req)}. ${formatNaira(req.amount_paid)} of ${formatNaira(req.amount)} has been paid so far.`,
          "Open requisition"
        )
        return
    }
  } catch (err) {
    log.error({ err: String(err), kind: event.kind, requisition: req.id }, "Requisition notifications failed")
  }
}

/**
 * The MD hears about a payment schedule twice: when Accounts sends it for
 * payment, and when what was paid is ready for his Approved signature.
 */
export async function notifyScheduleForMd(
  admin: SupabaseClient,
  input: {
    mdId: string | null
    actorId: string
    scheduleId: string
    scheduleNumber: string
    kind: "sent" | "approve"
    count: number
    total: number
  }
): Promise<void> {
  if (!input.mdId || input.count === 0) return
  const link = `/accounts/requisitions/schedules/${input.scheduleId}`
  const title =
    input.kind === "sent"
      ? `Payment schedule ${input.scheduleNumber} for payment`
      : `Payment schedule ${input.scheduleNumber}: paid, ready to approve`
  const message =
    input.kind === "sent"
      ? `${input.count} payment${input.count === 1 ? "" : "s"} totalling ${formatNaira(input.total)} are scheduled for payment.`
      : `${input.count} paid payment request${input.count === 1 ? " is" : "s are"} waiting for your Approved signature (${formatNaira(input.total)}).`
  try {
    const { error } = await admin.rpc("create_notification", {
      p_user_id: input.mdId,
      p_type: "approval_request",
      p_category: "approvals",
      p_title: title,
      p_message: message,
      p_priority: "high",
      p_link_url: link,
      p_actor_id: input.actorId,
      p_entity_type: "requisition_schedule",
      p_entity_id: input.scheduleId,
    })
    if (error) log.error({ err: error.message }, "Schedule notification rejected")

    const eligible = await resolveChannelEligibleUserIds(admin, {
      userIds: [input.mdId],
      notificationKey: "approvals",
      channel: "email",
    })
    if (!eligible.length) return
    const { data: person } = await admin
      .from("profiles")
      .select("id, first_name, full_name, company_email, additional_email")
      .eq("id", input.mdId)
      .maybeSingle<Person>()
    const to = (person?.company_email || person?.additional_email || "").trim()
    if (!to.includes("@")) return
    await sendNotificationEmailWithRetry({
      from: orgDepartmentSenderBare("Accounts"),
      to: [to],
      subject: `${title} (${formatNaira(input.total)})`,
      html: renderActionEmail({
        recipientFirstName: person?.first_name || "",
        heading: title,
        intro: message,
        detailsTitle: "Payment schedule",
        details: [
          ["Schedule", input.scheduleNumber],
          ["Payments", String(input.count)],
          ["Total", formatNaira(input.total)],
        ],
        ctaLabel: input.kind === "sent" ? "Open schedule" : "Review and approve",
        ctaPath: link,
        footerLabel: "Requisitions",
      }),
    })
  } catch (err) {
    log.error({ err: String(err), schedule: input.scheduleId }, "Schedule notification failed")
  }
}
