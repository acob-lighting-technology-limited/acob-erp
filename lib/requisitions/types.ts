export type RequisitionFormType = "payment_request" | "petty_cash"

/**
 * pending            in approval
 * awaiting_payment   signed off; Payment Requests wait to be put on a payment schedule
 * scheduled          on a payment schedule, waiting for the bank (Payment Requests)
 * partly_paid        some of it paid
 * awaiting_approval  paid in full, waiting for the MD's Approved signature (Payment Requests)
 * paid               closed
 */
export type RequisitionStatus =
  | "pending"
  | "awaiting_payment"
  | "scheduled"
  | "partly_paid"
  | "awaiting_approval"
  | "paid"
  | "rejected"

export type RequisitionStageCode = "reviewed" | "authorized" | "verified" | "approved"

export type RequisitionStageState = "pending" | "signed" | "bypassed" | "not_required" | "rejected"

/** Who a stage was routed to. */
export type RequisitionRoleKey = "hr_lead" | "hcs" | "accounts_lead" | "md" | "department_lead"

export type RequisitionPaymentMethod = "transfer" | "cash"

export interface BeneficiaryDetail {
  account_name: string
  account_number: string
  bank_name: string
  bank_code?: string
  /**
   * The account holder's name as the bank returned it when the requisition was
   * raised. Set by the server only; null when the bank could not be asked.
   */
  verified_account_name?: string | null
  /** What this account is paid for, on top of the requisition's main purpose. Optional. */
  purpose?: string
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
  /** Set on list rows: the viewer may record a payment on this one now. */
  can_pay?: boolean
  /** Payment officers for this form, so the route can show who pays next. */
  payment_officers?: RequisitionPerson[]
  id: string
  /** e.g. PR/HR/26/001: form (PR or PC), department code, year, serial. */
  requisition_number: string
  /** The REQ-/PCV- number it had before department numbering. Search only. */
  previous_number?: string | null
  /** Signature file the requester stamped when submitting; null on requisitions raised before this existed. */
  requester_signature_path?: string | null
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

  /** Deprecated: funding categories are no longer collected; older requisitions keep theirs. */
  funding_category_id?: string | null
  funding_category_name?: string | null
  help_desk_ticket_id?: string | null

  /** Set when a schedule line came back unpaid; cleared once paid in full. */
  unpaid_at?: string | null
  unpaid_note?: string | null
  unpaid_count?: number

  rejection_reason?: string | null
  rejected_by?: string | null
  rejected_at?: string | null

  created_at: string
  updated_at: string

  requester?: (RequisitionPerson & { company_email?: string | null }) | null
  /** Signed URL of the requester's stored signature, added by the detail API. */
  requester_signature_url?: string | null
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
  /** False once a Payment Request is paid: the MD signs it off but cannot reject. */
  can_reject: boolean
  /** What is missing before this user can sign or record a payment. */
  signing_setup_missing: ("signature" | "pin")[]
}

/** Someone ACOB pays, with the stable code the bank file uses as Beneficiary Code. */
export interface RequisitionPayee {
  id: string
  code: string
  kind: "staff" | "vendor"
  profile_id: string | null
  account_name: string
  account_number: string
  bank_code: string
  bank_name: string
  rc_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
  profile?: RequisitionPerson | null
}

export type PaymentScheduleStatus = "draft" | "sent" | "closed"

export type ScheduleItemOutcome = "pending" | "paid" | "unpaid"

export interface PaymentScheduleItem {
  id: string
  schedule_id: string
  requisition_id: string
  beneficiary_index: number
  payee_id: string
  amount: number
  transaction_ref: string
  beneficiary_code: string
  account_name: string
  account_number: string
  bank_code: string
  bank_name: string
  outcome: ScheduleItemOutcome
  outcome_note: string | null
  bank_reference: string | null
  receipt_path: string | null
  recorded_at: string | null
  recorder?: RequisitionPerson | null
  requisition?: Pick<
    Requisition,
    | "id"
    | "requisition_number"
    | "department"
    | "purpose"
    | "status"
    | "amount"
    | "amount_paid"
    | "user_id"
    | "form_type"
    | "created_at"
    | "stages"
    | "payments"
    | "payment_officers"
    | "unpaid_at"
    | "unpaid_note"
    | "unpaid_count"
  > & { requester?: RequisitionPerson | null }
  receipt_url?: string | null
}

export interface PaymentSchedule {
  id: string
  schedule_number: string
  status: PaymentScheduleStatus
  payment_date: string
  debit_account: string
  note: string | null
  created_by: string | null
  sent_at: string | null
  closed_at: string | null
  created_at: string
  creator?: RequisitionPerson | null
  sender?: RequisitionPerson | null
  items?: PaymentScheduleItem[]
  /** List rows: totals worked out by the API. */
  line_count?: number
  total_amount?: number
  paid_amount?: number
}

/** A verified Payment Request line that can go on a schedule. */
export interface SchedulableLine {
  requisition_id: string
  requisition_number: string
  department: string
  purpose: string | null
  requester_name: string | null
  /** When the requisition was raised. */
  requested_at: string
  /** The whole requisition's amount, for context beside its lines. */
  requisition_amount: number
  beneficiary_index: number
  account_name: string
  account_number: string
  bank_name: string
  /** Null when the bank could not be worked out; the officer picks it. */
  bank_code: string | null
  /** What this line pays, fixed by the requisition: never typed in. Null only when a split was never recorded. */
  amount: number | null
  outstanding: number
  unpaid_before: boolean
}
