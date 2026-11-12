import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isAdminLikeRole } from "@/lib/admin/rbac"
import { getMissingSetup, getSigningStatus, signedStorageUrl, SIGNATURE_BUCKET } from "@/lib/approval-signing/server"
import { isAssignableEmploymentStatus } from "@/lib/workforce/assignment-policy"
import { normalizeDepartmentName } from "@/shared/departments"
import { getOneDriveService } from "@/lib/onedrive"
import { isSharePointArchivePath } from "./archive"
import { logger } from "@/lib/logger"
import type { RoutingProfile } from "./routing"
import type {
  Requisition,
  RequisitionAttachment,
  RequisitionFormType,
  RequisitionPayment,
  RequisitionPerson,
  RequisitionStage,
  RequisitionViewerActions,
} from "./types"

const log = logger("requisitions-server")

export const REQUISITION_DOCUMENTS_BUCKET = "requisition_documents"

/**
 * Every read and write here takes the service-role client: requisitions are
 * read through API routes that decide access with `getViewerContext`, and the
 * RLS policies are the backstop for anything that reaches the table directly.
 */

const PERSON = "id, full_name, department, designation"

const REQUISITION_BASE_SELECT = `
  *,
  requester:profiles!requisitions_user_id_fkey(id, full_name, department, designation, company_email),
  stages:requisition_stages(
    id, requisition_id, position, stage_code, role_key, role_label, assignee_id, state, state_note,
    acted_by, acted_at, comments, signature_path,
    assignee:profiles!requisition_stages_assignee_id_fkey(${PERSON}),
    actor:profiles!requisition_stages_acted_by_fkey(${PERSON})
  )
`

// List rows also carry who recorded each payment and when, for the route's Payment block.
export const REQUISITION_LIST_SELECT = `
  ${REQUISITION_BASE_SELECT},
  payments:requisition_payments(
    id, amount, paid_on, recorded_by, created_at,
    recorder:profiles!requisition_payments_recorded_by_fkey(${PERSON})
  )
`

const REQUISITION_DETAIL_SELECT = `
  ${REQUISITION_BASE_SELECT},
  amount_changes:requisition_amount_changes(
    id, stage_id, changed_by, old_amount, new_amount, old_line_items, new_line_items, reason, created_at,
    changer:profiles!requisition_amount_changes_changed_by_fkey(${PERSON})
  ),
  payments:requisition_payments(
    id, amount, paid_on, method, reference, receipt_path, note, recorded_by, signature_path, created_at,
    recorder:profiles!requisition_payments_recorded_by_fkey(${PERSON})
  ),
  help_desk_ticket:help_desk_tickets(id, ticket_number, title)
`

export interface ViewerContext {
  userId: string
  department: string | null
  isAdminLike: boolean
  /** The forms this person records payments for (chosen in Admin > Requisitions > Settings). */
  paymentFormTypes: RequisitionFormType[]
  /** Departments this person leads (normalised). */
  leadDepartments: string[]
}

export async function getViewerContext(admin: SupabaseClient, userId: string): Promise<ViewerContext> {
  const [{ data: profile }, { data: processor }] = await Promise.all([
    admin
      .from("profiles")
      .select("role, department, is_department_lead, lead_departments")
      .eq("id", userId)
      .maybeSingle<{
        role: string | null
        department: string | null
        is_department_lead: boolean | null
        lead_departments: string[] | null
      }>(),
    admin.from("requisition_payment_processors").select("form_type").eq("profile_id", userId),
  ])

  const leadDepartments = profile?.is_department_lead
    ? Array.from(
        new Set(
          [profile.department, ...(profile.lead_departments || [])]
            .map((d) => normalizeDepartmentName(d))
            .filter(Boolean)
        )
      )
    : []

  return {
    userId,
    department: profile?.department ?? null,
    isAdminLike: isAdminLikeRole(profile?.role),
    paymentFormTypes: (processor || []).map((row) => row.form_type as RequisitionFormType),
    leadDepartments,
  }
}

/** Whether this person may see a requisition. Mirrors public.can_view_requisition. */
export function canViewRequisition(req: Requisition, viewer: ViewerContext): boolean {
  if (req.user_id === viewer.userId) return true
  if (viewer.isAdminLike || viewer.paymentFormTypes.length > 0) return true
  if (viewer.leadDepartments.includes(normalizeDepartmentName(req.department))) return true
  return (req.stages || []).some((s) => s.assignee_id === viewer.userId || s.acted_by === viewer.userId)
}

/** Everyone who can be routed a stage: active department leads. */
export async function loadRoutingLeads(admin: SupabaseClient): Promise<RoutingProfile[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, department, is_department_lead, lead_departments, employment_status")
    .eq("is_department_lead", true)
  if (error) throw new Error(`Failed to load department leads: ${error.message}`)
  return (data || []).filter((p) =>
    isAssignableEmploymentStatus(p.employment_status, { allowLegacyNullStatus: true })
  ) as RoutingProfile[]
}

function sortChildren(req: Requisition): Requisition {
  req.stages = [...(req.stages || [])].sort((a, b) => a.position - b.position)
  req.amount_changes = [...(req.amount_changes || [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
  req.payments = [...(req.payments || [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return req
}

export async function loadRequisition(admin: SupabaseClient, id: string): Promise<Requisition | null> {
  const { data, error } = await admin
    .from("requisitions")
    .select(REQUISITION_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle<Requisition>()
  if (error) throw new Error(`Failed to load requisition: ${error.message}`)
  return data ? sortChildren(data) : null
}

/** Adds short-lived signed URLs for attachments, signatures and receipts. */
/** Payment officers per form, for showing who pays next. */
export async function loadPaymentOfficers(admin: SupabaseClient): Promise<Record<string, RequisitionPerson[]>> {
  const { data } = await admin
    .from("requisition_payment_processors")
    .select(
      "form_type, person:profiles!requisition_payment_processors_profile_id_fkey(id, full_name, department, designation)"
    )
    .order("created_at")
  const byForm: Record<string, RequisitionPerson[]> = {}
  for (const row of (data || []) as unknown as { form_type: string; person: RequisitionPerson | null }[]) {
    if (row.person) (byForm[row.form_type] ||= []).push(row.person)
  }
  return byForm
}

export async function withSignedUrls(admin: SupabaseClient, req: Requisition): Promise<Requisition> {
  const onedrive = getOneDriveService()
  const onedriveEnabled = onedrive.isEnabled()

  const attachments = await Promise.all(
    (req.attachments || []).map(async (file: RequisitionAttachment): Promise<RequisitionAttachment> => {
      let signedUrl: string | null = null
      if (isSharePointArchivePath(file.file_path)) {
        if (onedriveEnabled) {
          try {
            signedUrl = await onedrive.getDownloadUrl(file.file_path)
          } catch (err) {
            log.warn("Failed to get SharePoint download URL for attachment", { path: file.file_path, err })
            signedUrl = file.web_url || null
          }
        } else {
          signedUrl = file.web_url || null
        }
      } else {
        signedUrl = await signedStorageUrl(admin, REQUISITION_DOCUMENTS_BUCKET, file.file_path)
      }

      return {
        ...file,
        signed_url: signedUrl,
      }
    })
  )

  const stages = await Promise.all(
    (req.stages || []).map(
      async (stage: RequisitionStage): Promise<RequisitionStage> => ({
        ...stage,
        signature_url: await signedStorageUrl(admin, SIGNATURE_BUCKET, stage.signature_path),
      })
    )
  )

  const payments = await Promise.all(
    (req.payments || []).map(async (payment: RequisitionPayment): Promise<RequisitionPayment> => {
      let receiptUrl: string | null = null
      if (payment.receipt_path) {
        if (isSharePointArchivePath(payment.receipt_path)) {
          if (onedriveEnabled) {
            try {
              receiptUrl = await onedrive.getDownloadUrl(payment.receipt_path)
            } catch (err) {
              log.warn("Failed to get SharePoint download URL for receipt", { path: payment.receipt_path, err })
              receiptUrl = null
            }
          }
        } else {
          receiptUrl = await signedStorageUrl(admin, REQUISITION_DOCUMENTS_BUCKET, payment.receipt_path)
        }
      }

      return {
        ...payment,
        receipt_url: receiptUrl,
        signature_url: await signedStorageUrl(admin, SIGNATURE_BUCKET, payment.signature_path),
      }
    })
  )

  // The requester signs the form too: "Requested by", and any stage they hold themselves
  // (an HR Lead's or the MD's own request). The signature stamped at submission is used;
  // requisitions raised before that existed fall back to the requester's current one.
  let requesterSignatureUrl: string | null = null
  try {
    requesterSignatureUrl = req.requester_signature_path
      ? await signedStorageUrl(admin, SIGNATURE_BUCKET, req.requester_signature_path)
      : (await getSigningStatus(admin, req.user_id)).signature_url
  } catch (err) {
    log.warn("Failed to load the requester's signature", { requisitionId: req.id, err })
  }

  const payment_officers = (await loadPaymentOfficers(admin))[req.form_type] ?? []

  return { ...req, attachments, stages, payments, payment_officers, requester_signature_url: requesterSignatureUrl }
}

/**
 * Whether a stage can be signed in the requisition's current status. A Payment
 * Request's Approved stage (the MD) waits until it has been paid; while it is in
 * approval, everything else can be. Mirrors requisition_sign.
 */
export function isStageOpen(
  req: Pick<Requisition, "form_type" | "status">,
  stage: Pick<RequisitionStage, "stage_code">
) {
  if (req.form_type !== "payment_request") return req.status === "pending"
  if (req.status === "awaiting_approval") return stage.stage_code === "approved"
  return req.status === "pending" && stage.stage_code !== "approved"
}

/** The stage a person would sign now, and what signing it would bypass. Mirrors requisition_sign. */
export function findSignableStage(req: Requisition, userId: string) {
  if ((req.status !== "pending" && req.status !== "awaiting_approval") || req.user_id === userId) return null
  const stages = [...(req.stages || [])].sort((a, b) => a.position - b.position)
  const stage = stages.find((s) => s.state === "pending" && s.assignee_id === userId && isStageOpen(req, s))
  if (!stage) return null
  const bypassed = stages.filter((s) => s.state === "pending" && s.position < stage.position)
  return { stage, bypassed }
}

export async function getViewerActions(
  admin: SupabaseClient,
  req: Requisition,
  viewer: ViewerContext
): Promise<RequisitionViewerActions> {
  const signable = findSignableStage(req, viewer.userId)
  // Payment Requests are paid through payment schedules, not one at a time.
  const canPay =
    req.form_type === "petty_cash" &&
    viewer.paymentFormTypes.includes(req.form_type) &&
    req.user_id !== viewer.userId &&
    (req.status === "awaiting_payment" || req.status === "partly_paid")
  const isRequester = req.user_id === viewer.userId
  // The requester may change the form until anyone has signed past them.
  const untouched = (req.stages || []).every(
    (s) => s.state !== "signed" && s.state !== "bypassed" && s.state !== "rejected"
  )
  return {
    sign_stage_id: signable?.stage.id ?? null,
    would_bypass_stage_ids: signable?.bypassed.map((s) => s.id) ?? [],
    can_edit: isRequester && (req.status === "rejected" || (req.status === "pending" && untouched)),
    can_convert: isRequester && req.status === "rejected",
    can_record_payment: canPay,
    // Once a Payment Request is paid the MD only signs it off; there is nothing left to reject.
    can_reject: Boolean(signable) && req.status === "pending",
    signing_setup_missing: signable || canPay ? await getMissingSetup(admin, viewer.userId) : [],
  }
}

/** The pending stage a requisition is waiting on (null when nothing is pending). */
export function currentStage(req: Requisition): RequisitionStage | null {
  if (req.status !== "pending" && req.status !== "awaiting_approval") return null
  return (
    [...(req.stages || [])]
      .sort((a, b) => a.position - b.position)
      .find((s) => s.state === "pending" && isStageOpen(req, s)) || null
  )
}
