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
    /** Where the notification opens; defaults to the requisition's staff page. */
    link?: string
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
        p_link_url: n.link ?? linkFor(req),
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
  ctaLabel: string,
  ctaPath: string = linkFor(req)
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
          ctaPath,
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

/** Payment officers work in the admin area: Payment Requests go to the schedules, Petty Cash to its requisition. */
async function notifyProcessors(admin: SupabaseClient, req: Requisition, actorId: string | null) {
  const ids = await processorIds(admin, req)
  const isPaymentRequest = req.form_type === "payment_request"
  const link = isPaymentRequest ? "/admin/accounts/schedules" : `/admin/accounts/requisitions/${req.id}`
  const title = isPaymentRequest
    ? `${FORM_LABELS[req.form_type]} ready for a payment schedule`
    : `${FORM_LABELS[req.form_type]} ready for payment`
  const message = isPaymentRequest
    ? `${req.requisition_number} for ${formatNaira(req.amount)} is verified and waiting to go on a payment schedule.`
    : `${req.requisition_number} for ${formatNaira(req.amount)} is fully signed and waiting to be paid.`
  await notifyInApp(admin, ids, req, actorId, { type: "approval_request", title, message, priority: "high", link })
  await emailActionNeeded(
    admin,
    ids,
    req,
    title,
    message,
    isPaymentRequest ? "Open payment schedules" : "Record payment",
    link
  )
}

/** Who still has to sign Approved on a Payment Request that has been paid. */
function awaitingApprover(req: Requisition): string | null {
  if (req.status !== "awaiting_approval") return null
  const stage = (req.stages || []).find((s) => s.stage_code === "approved" && s.state === "pending")
  return stage?.assignee?.full_name || "the MD"
}

/** " It now waits for X to approve it." once a Payment Request is paid but not yet signed off. */
function approvalNote(req: Requisition): string {
  const approver = awaitingApprover(req)
  return approver ? ` It now waits for ${approver} to approve it; you will be told when it is closed.` : ""
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
            ? `${req.requisition_number} has been paid in full (${formatNaira(req.amount)}).${approvalNote(req)}`
            : `${formatNaira(event.amount)} was paid on ${req.requisition_number}. ${formatNaira(req.amount_paid)} of ${formatNaira(req.amount)} paid so far.`,
          priority: "high",
        })
        await emailActionNeeded(
          admin,
          [req.user_id],
          req,
          paidInFull(req) ? "Requisition paid" : "Requisition partly paid",
          paidInFull(req)
            ? `Your ${label(req)} has been paid in full (${formatNaira(req.amount)}).${approvalNote(req)}`
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
 * When a schedule is finalized the bank file is emailed to the officer who
 * finalized it, to check it is exactly what he wants before anything goes to
 * the MD. The MD is not contacted here.
 */
export async function emailScheduleSheetToOfficer(
  admin: SupabaseClient,
  input: {
    officerId: string
    scheduleId: string
    scheduleNumber: string
    paymentDate: string
    count: number
    total: number
    fileName: string
    file: Buffer
  }
): Promise<boolean> {
  try {
    const { data: person } = await admin
      .from("profiles")
      .select("id, first_name, full_name, company_email, additional_email")
      .eq("id", input.officerId)
      .maybeSingle<Person>()
    const to = (person?.company_email || person?.additional_email || "").trim()
    if (!to.includes("@")) return false
    await sendNotificationEmailWithRetry({
      from: orgDepartmentSenderBare("Accounts"),
      to: [to],
      subject: `Check payment schedule ${input.scheduleNumber} (${formatNaira(input.total)})`,
      html: renderActionEmail({
        recipientFirstName: person?.first_name || "",
        heading: `Check payment schedule ${input.scheduleNumber}`,
        intro:
          "You finalized this schedule. The bank file is attached. Open it and check every line before it goes to the MD. The MD has not been told yet.",
        detailsTitle: "Payment schedule",
        details: [
          ["Schedule", input.scheduleNumber],
          ["Bank payment date", input.paymentDate],
          ["Payments", String(input.count)],
          ["Total", formatNaira(input.total)],
        ],
        ctaLabel: "Open schedule",
        ctaPath: `/admin/accounts/schedules/${input.scheduleId}`,
        footerLabel: "Requisitions",
      }),
      attachments: [{ filename: input.fileName, content: new Uint8Array(input.file) }],
    })
    return true
  } catch (err) {
    log.error({ err: String(err), schedule: input.scheduleId }, "Schedule sheet email failed")
    return false
  }
}

/**
 * The MD hears about a payment schedule once: when what was paid is ready for
 * his Approved signature.
 */
export async function notifyScheduleForMd(
  admin: SupabaseClient,
  input: {
    mdId: string | null
    actorId: string
    scheduleId: string
    scheduleNumber: string
    kind: "approve"
    count: number
    total: number
  }
): Promise<void> {
  if (!input.mdId || input.count === 0) return
  const link = `/admin/accounts/schedules/${input.scheduleId}`
  const title = `Payment schedule ${input.scheduleNumber}: paid, ready to approve`
  const message = `${input.count} paid payment request${input.count === 1 ? " is" : "s are"} waiting for your Approved signature (${formatNaira(input.total)}).`
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
        ctaLabel: "Review and approve",
        ctaPath: link,
        footerLabel: "Requisitions",
      }),
    })
  } catch (err) {
    log.error({ err: String(err), schedule: input.scheduleId }, "Schedule notification failed")
  }
}

/**
 * The officer, having checked the sheet, tells the MD it is ready to pay. The
 * bank file is attached so he can pay from the email as well as the page.
 */
export async function notifyMdToPay(
  admin: SupabaseClient,
  input: {
    mdId: string | null
    actorId: string
    scheduleId: string
    scheduleNumber: string
    paymentDate: string
    count: number
    total: number
    fileName: string
    file: Buffer
  }
): Promise<boolean> {
  if (!input.mdId) return false
  const link = `/admin/accounts/schedules/${input.scheduleId}`
  const title = `Payment schedule ${input.scheduleNumber} ready for payment`
  const message = `${input.count} payment${input.count === 1 ? "" : "s"} totalling ${formatNaira(input.total)} are ready to be paid on ${input.paymentDate}. The bank file is attached.`
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

    const { data: person } = await admin
      .from("profiles")
      .select("id, first_name, full_name, company_email, additional_email")
      .eq("id", input.mdId)
      .maybeSingle<Person>()
    const to = (person?.company_email || person?.additional_email || "").trim()
    if (!to.includes("@")) return false
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
          ["Bank payment date", input.paymentDate],
          ["Payments", String(input.count)],
          ["Total", formatNaira(input.total)],
        ],
        ctaLabel: "Open schedule",
        ctaPath: link,
        footerLabel: "Requisitions",
      }),
      attachments: [{ filename: input.fileName, content: new Uint8Array(input.file) }],
    })
    return true
  } catch (err) {
    log.error({ err: String(err), schedule: input.scheduleId }, "Notify MD failed")
    return false
  }
}
