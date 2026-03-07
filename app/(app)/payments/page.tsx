import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
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
  const dataClient = getServiceRoleClientOrFallback(supabase as any)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Fetch user profile with department info
  const { data: profile } = await dataClient
    .from("profiles")
    .select("department, department_id, is_admin")
    .eq("id", user.id)
    .single()

  let currentUserDepartmentId: string | null = null
  let isAdmin = false

  const resolveDepartmentCandidates = (department: string | null | undefined): string[] => {
    const raw = String(department || "").trim()
    if (!raw) return []
    if (raw.toLowerCase() === "finance") return ["Accounts", raw]
    return [raw]
  }

  if (profile) {
    currentUserDepartmentId = (profile as any).department_id || null
    if (!currentUserDepartmentId) {
      const candidates = resolveDepartmentCandidates(profile.department)
      if (candidates.length > 0) {
        const { data: dept } = await dataClient
          .from("departments")
          .select("id, name")
          .in("name", candidates)
          .limit(1)
          .maybeSingle()
        if (dept) {
          currentUserDepartmentId = dept.id
        }
      }
    }
  }

  // Build payments query - ALWAYS filter by user's department for user-facing page
  let paymentsQuery = dataClient
    .from("department_payments")
    .select(
      `
      *,
      department:departments(name),
      documents:payment_documents(id, document_type, file_path, file_name, applicable_date)
    `
    )
    .order("created_at", { ascending: false })

  // Always filter by user's department on the user-facing page
  if (currentUserDepartmentId) {
    paymentsQuery = paymentsQuery.eq("department_id", currentUserDepartmentId)
  }

  const { data: payments, error: paymentsError } = await paymentsQuery
  let loadError: string | null = null

  if (paymentsError) {
    console.error("Error loading payments:", paymentsError)
    loadError = "Failed to load payments"
  }

  // Fetch departments (just user's department for the dropdown in create form)
  const { data: departments } = await dataClient
    .from("departments")
    .select("id, name")
    .eq("id", currentUserDepartmentId || "")

  // Fetch categories
  const { data: categories } = await dataClient.from("payment_categories").select("id, name").order("name")

  return {
    payments: (payments || []) as Payment[],
    departments: (departments || []) as Department[],
    categories: (categories || []) as Category[],
    loadError,
    currentUser: {
      id: user.id,
      department_id: currentUserDepartmentId,
      is_admin: false, // Always false for user-facing page - hides admin controls
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
    loadError?: string | null
    currentUser: { id: string; department_id: string | null; is_admin: boolean }
  }

  return (
    <PaymentsTable
      initialPayments={paymentsData.payments}
      initialDepartments={paymentsData.departments}
      initialCategories={paymentsData.categories}
      initialError={paymentsData.loadError}
      currentUser={paymentsData.currentUser}
      basePath="/payments"
    />
  )
}
