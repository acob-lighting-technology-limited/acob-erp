export interface PaymentDocument {
  id: string
  document_type: "invoice" | "receipt" | "other"
  file_name: string
  file_path: string
  applicable_date: string | null
  created_at: string
  is_archived?: boolean
  replaced_by?: string
  archived_at?: string
}

export interface Payment {
  id: string
  department_id: string
  payment_type: "one-time" | "recurring"
  category: string
  title: string
  description?: string
  amount: number
  currency: string
  status: "due" | "paid" | "overdue" | "cancelled"
  recurrence_period?: "monthly" | "quarterly" | "yearly"
  next_payment_due?: string
  payment_date?: string
  created_at: string
  issuer_name?: string
  issuer_phone_number?: string
  issuer_address?: string
  payment_reference?: string
  amount_paid?: number
  notes?: string
  department?: {
    name: string
  }
  documents?: PaymentDocument[]
  project?: { id: string; project_name: string } | null
  site?: StarlinkKit | null
}

/** A Starlink kit (`starlink_sites`). `serial_number` holds the ACC-... account number. */
export interface StarlinkKit {
  id: string
  site_name: string
  state: string | null
  serial_number: string | null
  kit_number: string | null
}

export interface Department {
  id: string
  name: string
}

export interface Category {
  id: string
  name: string
  type?: "credit" | "debit"
}

export interface ScheduleItem {
  date: Date
  status: "paid" | "due" | "upcoming" | "overdue"
  label: string
  documents: PaymentDocument[]
}

export interface PaymentEditFormData {
  department_id: string
  payment_type: "one-time" | "recurring" | ""
  category: string
  title: string
  description: string
  amount: string
  currency: string
  recurrence_period: string
  next_payment_due: string
  payment_date: string
  issuer_name: string
  issuer_phone_number: string
  issuer_address: string
  payment_reference: string
  notes: string
}
