import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isAdminLikeRole } from "@/lib/admin/rbac"
import { getMissingSetup, signedStorageUrl, SIGNATURE_BUCKET } from "@/lib/approval-signing/server"
import { isAssignableEmploymentStatus } from "@/lib/workforce/assignment-policy"
import { normalizeDepartmentName } from "@/shared/departments"
import type { RoutingProfile } from "./routing"
import type {
  Requisition,
  RequisitionAttachment,
  RequisitionPayment,
  RequisitionStage,
  RequisitionViewerActions,
} from "./types"

export const REQUISITION_DOCUMENTS_BUCKET = "requisition_documents"

/**
 * Every read and write here takes the service-role client: requisitions are
 * read through API routes that decide access with `getViewerContext`, and the
 * RLS policies are the backstop for anything that reaches the table directly.
 */

const PERSON = "id, full_name, department, designation"

export const REQUISITION_LIST_SELECT = `
  *,
  requester:profiles!requisitions_user_id_fkey(id, full_name, department, designation, company_email),
  stages:requisition_stages(
    id, requisition_id, position, stage_code, role_key, role_label, assignee_id, state, state_note,
    acted_by, acted_at, comments, signature_path,
    assignee:profiles!requisition_stages_assignee_id_fkey(${PERSON}),
    actor:profiles!requisition_stages_acted_by_fkey(${PERSON})
  )
`

const REQUISITION_DETAIL_SELECT = `
  ${REQUISITION_LIST_SELECT},
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
  isPaymentProcessor: boolean
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
    admin.rpc("is_requisition_payment_processor", { p_user_id: userId }),
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
    isPaymentProcessor: processor === true,
    leadDepartments,
  }
}

/** Whether this person may see a requisition. Mirrors public.can_view_requisition. */
export function canViewRequisition(req: Requisition, viewer: ViewerContext): boolean {
  if (req.user_id === viewer.userId) return true
  if (viewer.isAdminLike || viewer.isPaymentProcessor) return true
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
export async function withSignedUrls(admin: SupabaseClient, req: Requisition): Promise<Requisition> {
  const attachments = await Promise.all(
    (req.attachments || []).map(
      async (file: RequisitionAttachment): Promise<RequisitionAttachment> => ({
        ...file,
        signed_url: await signedStorageUrl(admin, REQUISITION_DOCUMENTS_BUCKET, file.file_path),
      })
    )
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
    (req.payments || []).map(
      async (payment: RequisitionPayment): Promise<RequisitionPayment> => ({
        ...payment,
        receipt_url: await signedStorageUrl(admin, REQUISITION_DOCUMENTS_BUCKET, payment.receipt_path),
        signature_url: await signedStorageUrl(admin, SIGNATURE_BUCKET, payment.signature_path),
      })
    )
  )
  return { ...req, attachments, stages, payments }
}

/** The stage a person would sign now, and what signing it would bypass. Mirrors requisition_sign. */
export function findSignableStage(req: Requisition, userId: string) {
  if (req.status !== "pending" || req.user_id === userId) return null
  const stages = [...(req.stages || [])].sort((a, b) => a.position - b.position)
  const stage = stages.find((s) => s.state === "pending" && s.assignee_id === userId)
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
  const canPay =
    viewer.isPaymentProcessor &&
    req.user_id !== viewer.userId &&
    (req.status === "awaiting_payment" || req.status === "partly_paid")
  return {
    sign_stage_id: signable?.stage.id ?? null,
    would_bypass_stage_ids: signable?.bypassed.map((s) => s.id) ?? [],
    can_record_payment: canPay,
    signing_setup_missing: signable || canPay ? await getMissingSetup(admin, viewer.userId) : [],
  }
}

/** The pending stage a requisition is waiting on (null when nothing is pending). */
export function currentStage(req: Requisition): RequisitionStage | null {
  if (req.status !== "pending") return null
  return [...(req.stages || [])].sort((a, b) => a.position - b.position).find((s) => s.state === "pending") || null
}
