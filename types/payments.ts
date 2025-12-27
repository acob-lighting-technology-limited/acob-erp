// Department Payment Management System Types

export type PaymentType = 'one-time' | 'recurring';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type RecurrencePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type DocumentType = 'invoice' | 'receipt' | 'requisition' | 'approval' | 'other';

export interface Department {
    id: string;
    name: string;
    description?: string;
    department_head_id?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PaymentCategory {
    id: string;
    name: string;
    description?: string;
    created_at: string;
}

export interface DepartmentPayment {
    id: string;
    department_id: string;

    // Payment details
    payment_type: PaymentType;
    category: string; // User-defined (e.g., 'Starlink', 'Internet', 'Rent')
    title: string;
    description?: string;
    amount: number;
    currency: string;

    // Recurring payment fields (null for one-time)
    recurrence_period?: RecurrencePeriod;
    next_payment_due?: string;
    last_payment_date?: string;

    // One-time payment fields (null for recurring)
    payment_date?: string;

    // Status
    status: PaymentStatus;

    // Documents and tracking
    invoice_number?: string;
    payment_reference?: string;
    notes?: string;

    // Metadata
    created_by?: string;
    created_at: string;
    updated_at: string;

    // Joined data
    department?: Department;
}

export interface PaymentDocument {
    id: string;
    payment_id: string;
    document_type: DocumentType;
    file_name: string;
    file_path: string;
    file_size?: number;
    mime_type?: string;
    description?: string;
    uploaded_by?: string;
    uploaded_at: string;

    // Joined data
    payment?: DepartmentPayment;
}

// Form data types
export interface OneTimePaymentFormData {
    department_id: string;
    category: string;
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    payment_date: string;
    invoice_number?: string;
    payment_reference?: string;
    notes?: string;
}

export interface RecurringPaymentFormData {
    department_id: string;
    category: string;
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    recurrence_period: RecurrencePeriod;
    next_payment_due: string;
    invoice_number?: string;
    notes?: string;
}

export interface PaymentDocumentUpload {
    payment_id: string;
    document_type: DocumentType;
    file: File;
    description?: string;
}

// Dashboard/Stats types
export interface DepartmentPaymentStats {
    total_payments: number;
    one_time_payments: number;
    recurring_payments: number;
    pending_payments: number;
    overdue_payments: number;
    total_amount_pending: number;
    total_amount_paid: number;
    upcoming_payments: Array<{
        id: string;
        title: string;
        category: string;
        amount: number;
        next_payment_due: string;
        days_until_due: number;
    }>;
}

export interface PaymentsByCategory {
    category: string;
    count: number;
    total_amount: number;
    pending_amount: number;
}

// API Response types
export interface PaymentApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

export interface DepartmentPaymentWithDocuments extends DepartmentPayment {
    documents?: PaymentDocument[];
    document_count: number;
}
