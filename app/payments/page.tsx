import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PaymentsContent } from "./payments-content"

export interface Payment {
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
  notes?: string
  issuer_name?: string
  issuer_phone_number?: string
  issuer_address?: string
  payment_reference?: string
  amount_paid?: number
  created_at: string
  created_by?: string
  department?: {
    name: string
  }
}

export interface Department {
  id: string
  name: string
}

export interface Category {
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

  // Fetch user profile with department info
  const { data: profile } = await supabase.from("profiles").select("department, is_admin").eq("id", user.id).single()

  let currentUserDepartmentId: string | null = null
  let isAdmin = false

  if (profile) {
    isAdmin = profile.is_admin

    // Fetch department ID
    const { data: dept } = await supabase.from("departments").select("id, name").eq("name", profile.department).single()

    if (dept) {
      currentUserDepartmentId = dept.id
    }
  }

  // Fetch payments via API route (to use existing logic)
  // For server component, we need to fetch directly
  let paymentsQuery = supabase
    .from("department_payments")
    .select(
      `
      *,
      department:departments(name)
    `
    )
    .order("created_at", { ascending: false })

  // Filter by department if not admin
  if (!isAdmin && currentUserDepartmentId) {
    paymentsQuery = paymentsQuery.eq("department_id", currentUserDepartmentId)
  }

  const { data: payments, error: paymentsError } = await paymentsQuery

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
      department_id: currentUserDepartmentId,
      is_admin: isAdmin,
    },
  }
}

export default async function DepartmentPaymentsPage() {
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
    <PaymentsContent
      initialPayments={paymentsData.payments}
      initialDepartments={paymentsData.departments}
      initialCategories={paymentsData.categories}
      currentUser={paymentsData.currentUser}
    />
  )
}
