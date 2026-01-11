// Starlink Payment Management System Types

export type PaymentStatus = "pending" | "paid" | "overdue" | "cancelled"
export type DocumentType = "invoice" | "receipt" | "requisition" | "other"

export interface StarlinkSite {
  id: string
  state: string
  site_name: string
  email: string
  phone_number: string
  serial_number: string
  is_active: boolean
  notes?: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface StarlinkPayment {
  id: string
  site_id: string
  invoice_number: string
  billing_period_start: string
  billing_period_end: string
  next_payment_due: string
  amount?: number
  currency: string
  payment_status: PaymentStatus
  payment_date?: string
  payment_reference?: string
  reminder_sent: boolean
  reminder_sent_at?: string
  requisition_raised: boolean
  requisition_raised_at?: string
  notes?: string
  created_at: string
  updated_at: string
  created_by?: string

  // Joined data
  site?: StarlinkSite
}

export interface StarlinkDocument {
  id: string
  payment_id: string
  document_type: DocumentType
  file_name: string
  file_path: string
  file_size?: number
  mime_type?: string
  description?: string
  uploaded_by?: string
  uploaded_at: string

  // Joined data
  payment?: StarlinkPayment
}

export interface UpcomingPayment {
  payment_id: string
  site_id: string
  site_name: string
  state: string
  next_payment_due: string
  days_until_due: number
  invoice_number: string
  amount?: number
  reminder_sent: boolean
}

export interface StarlinkDashboardStats {
  total_sites: number
  active_sites: number
  total_payments: number
  pending_payments: number
  overdue_payments: number
  payments_due_this_week: number
  payments_due_this_month: number
  total_amount_pending: number
  upcoming_payments: Array<{
    site_name: string
    state: string
    due_date: string
    days_until_due: number
    amount?: number
  }>
}

export interface StarlinkSiteFormData {
  state: string
  site_name: string
  email: string
  phone_number: string
  serial_number: string
  notes?: string
}

export interface StarlinkPaymentFormData {
  site_id: string
  invoice_number: string
  billing_period_start: string
  billing_period_end: string
  next_payment_due: string
  amount?: number
  currency?: string
  payment_status?: PaymentStatus
  notes?: string
}

export interface StarlinkDocumentUpload {
  payment_id: string
  document_type: DocumentType
  file: File
  description?: string
}

// API Response types
export interface StarlinkApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface StarlinkSiteWithPayments extends StarlinkSite {
  latest_payment?: StarlinkPayment
  payment_count: number
  next_payment_due?: string
  days_until_due?: number
}
