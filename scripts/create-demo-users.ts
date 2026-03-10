import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"

loadEnv({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const password = "griezzman"
const currentYear = 2026

type DemoUser = {
  email: string
  firstName: string
  lastName: string
  department: string
  companyRole: string
  employeeNumber: string
  role: "employee" | "admin"
  adminDomains?: string[] | null
  isDepartmentLead?: boolean
  leadDepartments?: string[]
}

const demoUsers: DemoUser[] = [
  {
    email: "demo.employee@acoblighting.com",
    firstName: "Demo",
    lastName: "Employee",
    department: "Demo Operations",
    companyRole: "Support Officer",
    employeeNumber: `ACOB/${currentYear}/901`,
    role: "employee",
    isDepartmentLead: false,
    leadDepartments: [],
  },
  {
    email: "demo.reliever@acoblighting.com",
    firstName: "Demo",
    lastName: "Reliever",
    department: "Demo Operations",
    companyRole: "Operations Assistant",
    employeeNumber: `ACOB/${currentYear}/902`,
    role: "employee",
    isDepartmentLead: false,
    leadDepartments: [],
  },
  {
    email: "demo.lead@acoblighting.com",
    firstName: "Demo",
    lastName: "Lead",
    department: "Demo Operations",
    companyRole: "Department Lead",
    employeeNumber: `ACOB/${currentYear}/903`,
    role: "employee",
    isDepartmentLead: true,
    leadDepartments: ["Demo Operations"],
  },
  {
    email: "demo.hr.admin@acoblighting.com",
    firstName: "Demo",
    lastName: "HRAdmin",
    department: "Admin & HR",
    companyRole: "HR Admin",
    employeeNumber: `ACOB/${currentYear}/904`,
    role: "admin",
    adminDomains: ["hr"],
    isDepartmentLead: false,
    leadDepartments: [],
  },
  {
    email: "demo.ops.admin@acoblighting.com",
    firstName: "Demo",
    lastName: "OpsAdmin",
    department: "Demo Operations",
    companyRole: "Operations Admin",
    employeeNumber: `ACOB/${currentYear}/905`,
    role: "admin",
    adminDomains: ["tasks", "communications"],
    isDepartmentLead: false,
    leadDepartments: [],
  },
]

async function findAuthUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Failed to list users while searching for ${normalized}: ${error.message}`)

    const match = data.users.find((user) => user.email?.toLowerCase() === normalized)
    if (match) return match
    if (data.users.length < perPage) return null
    page += 1
  }
}

async function ensureDemoUser(user: DemoUser) {
  const normalizedEmail = user.email.toLowerCase()
  const existingAuthUser = await findAuthUserByEmail(normalizedEmail)

  let authUserId = existingAuthUser?.id

  if (!authUserId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: user.firstName,
        last_name: user.lastName,
        full_name: `${user.firstName} ${user.lastName}`,
      },
    })

    if (error || !data.user) {
      throw new Error(`Failed to create auth user for ${normalizedEmail}: ${error?.message || "unknown error"}`)
    }

    authUserId = data.user.id
  } else {
    const { error } = await supabase.auth.admin.updateUserById(authUserId, {
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: user.firstName,
        last_name: user.lastName,
        full_name: `${user.firstName} ${user.lastName}`,
      },
    })

    if (error) {
      throw new Error(`Failed to update auth user for ${normalizedEmail}: ${error.message}`)
    }
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: authUserId,
      company_email: normalizedEmail,
      first_name: user.firstName,
      last_name: user.lastName,
      department: user.department,
      company_role: user.companyRole,
      employee_number: user.employeeNumber,
      role: user.role,
      is_admin: user.role === "admin",
      admin_domains: user.role === "admin" ? user.adminDomains || [] : null,
      is_department_lead: user.isDepartmentLead ?? false,
      lead_departments: user.leadDepartments || [],
      employment_status: "active",
      employment_date: `${currentYear}-01-15`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  )

  if (profileError) {
    throw new Error(`Failed to upsert profile for ${normalizedEmail}: ${profileError.message}`)
  }

  return {
    email: normalizedEmail,
    role: user.role,
    department: user.department,
    employeeNumber: user.employeeNumber,
    adminDomains: user.adminDomains || [],
    isDepartmentLead: user.isDepartmentLead ?? false,
  }
}

async function main() {
  const results = []

  for (const user of demoUsers) {
    results.push(await ensureDemoUser(user))
  }

  console.table(results)
  console.log(`Created or updated ${results.length} demo users with password "${password}".`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
