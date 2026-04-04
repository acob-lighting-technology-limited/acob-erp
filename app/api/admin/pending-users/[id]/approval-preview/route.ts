import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { buildApprovalEmailPreview } from "@/lib/onboarding/approval-email-preview"
import { createClient as createServerClient } from "@/lib/supabase/server"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()

  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", caller.id).single()
  if (!callerProfile || !["developer", "super_admin", "admin"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "System configuration error" }, { status: 500 })
  }

  const employeeId = new URL(req.url).searchParams.get("employeeId")?.trim()
  if (!employeeId) {
    return NextResponse.json({ error: "Missing employeeId" }, { status: 400 })
  }

  const empNumPattern = /^ACOB\/[0-9]{4}\/[0-9]{3}$/
  if (!empNumPattern.test(employeeId)) {
    return NextResponse.json(
      { error: "Employee number must be in format: ACOB/YEAR/NUMBER (e.g., ACOB/2026/058)" },
      { status: 400 }
    )
  }

  const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: pendingUser, error } = await supabaseAdmin
    .from("pending_users")
    .select(
      "first_name, last_name, department, designation, company_email, personal_email, phone_number, office_location"
    )
    .eq("id", params.id)
    .single()

  if (error || !pendingUser) {
    return NextResponse.json({ error: "Pending user not found" }, { status: 404 })
  }

  const requiredFields = [
    "company_email",
    "personal_email",
    "first_name",
    "last_name",
    "department",
    "designation",
  ] as const
  const missingFields = requiredFields.filter((field) => !pendingUser[field])

  if (missingFields.length > 0) {
    return NextResponse.json({ error: `Missing required user data: ${missingFields.join(", ")}` }, { status: 422 })
  }

  const preview = await buildApprovalEmailPreview({
    supabase: supabaseAdmin,
    pendingUser,
  })

  return NextResponse.json(preview)
}
