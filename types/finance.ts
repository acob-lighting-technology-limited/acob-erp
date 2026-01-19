/**
 * Finance Module Types
 * Types specific to Finance and Accounting functionality
 */

// ============================================
// Payment Types (Existing - Moved from database.ts)
// ============================================

export type PaymentType = "one-time" | "recurring"
export type PaymentStatus = "pending" | "paid" | "due" | "overdue" | "cancelled"
export type RecurrencePeriod = "weekly" | "monthly" | "quarterly" | "yearly"

export interface DepartmentPayment {
  id: string
  department_id: string
  payment_type: PaymentType
  category: string
  title: string
  description?: string
  amount?: number
  currency: string
  recurrence_period?: RecurrencePeriod
  next_payment_due?: string
  last_payment_date?: string
  payment_date?: string
  status: PaymentStatus
  payment_reference?: string
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
  issuer_name?: string
  issuer_phone_number?: string
  issuer_address?: string
  amount_paid?: number
  // Starlink specific
  invoice_number?: string
  site_id?: string
  site_name?: string
  site_state?: string
  site_serial_number?: string
}

export interface PaymentDocument {
  id: string
  payment_id: string
  document_type: string
  file_path: string
  file_name: string
  applicable_date?: string
  created_at: string
}

export interface PaymentFormData {
  department_id: string
  payment_type: PaymentType
  category: string
  title: string
  description?: string
  amount: number
  currency?: string
  recurrence_period?: RecurrencePeriod
  next_payment_due?: string
  payment_date?: string
  issuer_name: string
  issuer_phone_number: string
  issuer_address?: string
  payment_reference?: string
  notes?: string
}

// ============================================
// Invoice Types (New)
// ============================================

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled"

export interface Invoice {
  id: string
  invoice_number: string
  customer_id?: string
  customer_name: string
  customer_email?: string
  customer_address?: string
  issue_date: string
  due_date: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  amount_paid: number
  balance_due: number
  currency: string
  status: InvoiceStatus
  notes?: string
  terms?: string
  created_by: string
  created_at: string
  updated_at: string
  paid_at?: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  amount: number
  created_at: string
}

export interface InvoiceFormData {
  customer_name: string
  customer_email?: string
  customer_address?: string
  issue_date: string
  due_date: string
  items: InvoiceItemFormData[]
  notes?: string
  terms?: string
  currency?: string
}

export interface InvoiceItemFormData {
  description: string
  quantity: number
  unit_price: number
  tax_rate?: number
}

// ============================================
// Bill Types (Accounts Payable - New)
// ============================================

export type BillStatus = "pending" | "approved" | "paid" | "overdue" | "cancelled"

export interface Bill {
  id: string
  bill_number: string
  supplier_id?: string
  supplier_name: string
  bill_date: string
  due_date: string
  subtotal: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  balance_due: number
  currency: string
  status: BillStatus
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
  paid_at?: string
}

export interface BillItem {
  id: string
  bill_id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  amount: number
}

// ============================================
// Chart of Accounts Types (New)
// ============================================

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense"

export interface ChartOfAccount {
  id: string
  account_code: string
  account_name: string
  account_type: AccountType
  parent_id?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================
// Bank Account Types (New)
// ============================================

export interface BankAccount {
  id: string
  account_name: string
  bank_name: string
  account_number: string
  account_type: "checking" | "savings" | "money_market"
  currency: string
  opening_balance: number
  current_balance: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================
// Financial Report Types
// ============================================

export interface PaymentStatistics {
  total: number
  oneTime: number
  recurring: number
  totalAmount: number
  paid: number
  due: number
}

export interface FinancialSummary {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  accountsReceivable: number
  accountsPayable: number
  cashBalance: number
}
