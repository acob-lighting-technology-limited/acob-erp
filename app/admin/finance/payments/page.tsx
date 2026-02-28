import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PaymentsTable } from "@/components/payments/payments-table"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"

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

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope) {
    return { redirect: "/dashboard" as const }
  }
  const departmentScope = getDepartmentScope(scope, "finance")

  let paymentsQuery = supabase
    .from("department_payments")
    .select(
      `
      *,
      department:departments(name),
      documents:payment_documents(id, document_type, file_path, file_name, applicable_date)
    `
    )
    .order("created_at", { ascending: false })

  if (departmentScope) {
    const { data: scopedDepartments } = await supabase.from("departments").select("id").in("name", departmentScope)
    const departmentIds = (scopedDepartments || []).map((dept) => dept.id)
    paymentsQuery =
      departmentIds.length > 0 ? paymentsQuery.in("department_id", departmentIds) : paymentsQuery.eq("id", "__none__")
  }

  const { data: payments, error: paymentsError } = await paymentsQuery

  if (paymentsError) {
    console.error("Error loading payments:", paymentsError)
  }

  let departmentsQuery = supabase.from("departments").select("id, name").order("name")
  if (departmentScope) {
    departmentsQuery =
      departmentScope.length > 0 ? departmentsQuery.in("name", departmentScope) : departmentsQuery.eq("id", "__none__")
  }
  const { data: departments } = await departmentsQuery

  // Fetch categories
  const { data: categories } = await supabase.from("payment_categories").select("id, name").order("name")

  return {
    payments: (payments || []) as Payment[],
    departments: (departments || []) as Department[],
    categories: (categories || []) as Category[],
    currentUser: {
      id: user.id,
      department_id: null, // Admin doesn't have a specific department filter
      is_admin: true,
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
      basePath="/admin/finance/payments"
    />
  )
}
