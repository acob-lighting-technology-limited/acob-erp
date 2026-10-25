export type RequisitionFormType = "payment_request" | "petty_cash"

export type RequisitionStatus = "pending" | "awaiting_payment" | "partly_paid" | "paid" | "rejected"

export type RequisitionStageCode = "reviewed" | "authorized" | "verified" | "approved"

export type RequisitionStageState = "pending" | "signed" | "bypassed" | "not_required" | "rejected"

/** Who a stage was routed to. */
export type RequisitionRoleKey = "hr_lead" | "hcs" | "accounts_lead" | "md" | "department_lead"

export type RequisitionPaymentMethod = "transfer" | "cash"

export interface BeneficiaryDetail {
  account_name: string
  account_number: string
  bank_name: string
  amount?: number | string
}

export interface RequisitionLineItem {
  description: string
  amount: number
}

export interface RequisitionAttachment {
  file_name: string
  /** Path inside the private requisition_documents bucket or SharePoint archive. */
  file_path: string
  file_type?: string
  file_size?: number
  /** Short-lived signed URL or SharePoint download URL, added by the API when the requisition is read. */
  signed_url?: string | null
  /** Direct SharePoint web link if archived. */
  web_url?: string | null
  /** Timestamp when the attachment was archived to SharePoint. */
  archived_at?: string | null
}

export interface RequisitionFundingCategory {
  id: string
  code: string
  name: string
  description?: string | null
  is_active: boolean
  sort_order: number
}

export interface RequisitionPerson {
  id: string
  full_name: string | null
  department?: string | null
  designation?: string | null
}

export interface RequisitionStage {
  id: string
  requisition_id: string
  position: number
  stage_code: RequisitionStageCode
  role_key: RequisitionRoleKey
  role_label: string
  assignee_id: string | null
  state: RequisitionStageState
  state_note: string | null
  acted_by: string | null
  acted_at: string | null
  comments: string | null
  signature_path: string | null
  assignee?: RequisitionPerson | null
  actor?: RequisitionPerson | null
  /** Signed URL of the signature captured at signing, added by the API. */
  signature_url?: string | null
}

export interface RequisitionAmountChange {
  id: string
  stage_id: string | null
  changed_by: string | null
  old_amount: number
  new_amount: number
  old_line_items: RequisitionLineItem[]
  new_line_items: RequisitionLineItem[]
  reason: string
  created_at: string
  changer?: RequisitionPerson | null
}

export interface RequisitionPayment {
  id: string
  amount: number
  paid_on: string
  method: RequisitionPaymentMethod
  reference: string | null
  receipt_path: string | null
  note: string | null
  recorded_by: string | null
  signature_path: string | null
  created_at: string
  recorder?: RequisitionPerson | null
  receipt_url?: string | null
  signature_url?: string | null
}

export interface Requisition {
  /** Set on list rows: the pending stage the signed-in user can sign now, else null. */
  sign_stage_id?: string | null
  id: string
  requisition_number: string
  form_type: RequisitionFormType
  user_id: string
  department: string
  project_name: string | null
  purpose: string | null
  site_location: string | null
  amount: number
  original_amount: number
  amount_paid: number
  amount_in_words: string
  line_items: RequisitionLineItem[]
  beneficiary_details: BeneficiaryDetail[]
  attachments: RequisitionAttachment[]
  status: RequisitionStatus

  funding_category_id?: string | null
  funding_category_name?: string | null
  help_desk_ticket_id?: string | null

  rejection_reason?: string | null
  rejected_by?: string | null
  rejected_at?: string | null

  created_at: string
  updated_at: string

  requester?: (RequisitionPerson & { company_email?: string | null }) | null
  stages?: RequisitionStage[]
  amount_changes?: RequisitionAmountChange[]
  payments?: RequisitionPayment[]
  help_desk_ticket?: { id: string; ticket_number: string; title: string } | null
}

/** What the signed-in user may do on a requisition, computed by the API. */
export interface RequisitionViewerActions {
  /** The pending stage this user would sign (bypassing anything before it). */
  sign_stage_id: string | null
  /** Stage ids that signing now would bypass. */
  would_bypass_stage_ids: string[]
  can_record_payment: boolean
  /** What is missing before this user can sign or record a payment. */
  signing_setup_missing: ("signature" | "pin")[]
}
