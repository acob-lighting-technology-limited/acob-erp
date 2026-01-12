import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PaymentsTable } from "@/components/payments/payments-table"

interface Payment {
  id: string
  department_id: string
  title: string
  amount: number
  currency: string
  status: "due" | "paid" | "overdue" | "cancelled"
  payment_type: "one-time" | "recurring"
  recurrence_period?: "monthly" | "quarterly" | "yearly"
  next_payment_due?: string
  payment_date?: string
  category: string
  description?: string
  issuer_name?: string
  issuer_phone_number?: string
  issuer_address?: string
  payment_reference?: string
  amount_paid?: number
  created_at: string
  department?: {
    name: string
  }
  documents?: {
    id: string
    document_type: string
    file_path: string
    file_name?: string
    applicable_date?: string
  }[]
}

interface Department {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
}

async function getPaymentsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Check if user is admin
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()
  const isAdmin = profile?.is_admin || false

  // Fetch all payments (admin sees all)
  const { data: payments, error: paymentsError } = await supabase
    .from("department_payments")
    .select(
      `
      *,
      department:departments(name),
      documents:payment_documents(id, document_type, file_path, file_name, applicable_date)
    `
    )
    .order("created_at", { ascending: false })

  if (paymentsError) {
    console.error("Error loading payments:", paymentsError)
  }

  // Fetch departments
  const { data: departments } = await supabase.from("departments").select("id, name").order("name")

  // Fetch categories
  const { data: categories } = await supabase.from("payment_categories").select("id, name").order("name")

  return {
    payments: (payments || []) as Payment[],
    departments: (departments || []) as Department[],
    categories: (categories || []) as Category[],
    currentUser: {
      id: user.id,
      department_id: null, // Admin doesn't have a specific department filter
      is_admin: isAdmin,
    },
  }
}

export default async function AdminPaymentsPage() {
  const data = await getPaymentsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const paymentsData = data as {
    payments: Payment[]
    departments: Department[]
    categories: Category[]
    currentUser: { id: string; department_id: string | null; is_admin: boolean }
  }

  return (
    <PaymentsTable
      initialPayments={paymentsData.payments}
      initialDepartments={paymentsData.departments}
      initialCategories={paymentsData.categories}
      currentUser={paymentsData.currentUser}
      basePath="/admin/payments"
    />
  )
}
