import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseJsonBody } from "@/lib/api/parse-body"
import { createClient } from "@/lib/supabase/server"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { getRequestScope, type AdminScope } from "@/lib/admin/api-scope"

function assertHR(scope: AdminScope | null) {
  return scope?.isAdminLike === true && scope.scopeMode !== "lead"
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase.from("approval_sla_policies").select("*").order("stage")

    if (error) return NextResponse.json({ error: "Failed to fetch SLA policies" }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

const SlaPolicySchema = z.object({
  stage: z.string().trim().min(1).max(100),
  due_hours: z.number().int().min(1).max(1440),
  reminder_hours_before: z.number().int().min(0).max(1440).optional(),
  escalate_to_role: z.string().trim().max(100).nullable().optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(request: NextRequest) {
  const rl = await rateLimit(`hr-leave-sla:${getClientId(request)}`, { limit: 15, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const isHR = assertHR(await getRequestScope())
    if (!isHR) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Only known columns are accepted; the upsert used to take the raw body.
    const parsed = await parseJsonBody(request, z.union([z.array(SlaPolicySchema).max(50), SlaPolicySchema]))
    if (!parsed.ok) return parsed.response
    const payload = Array.isArray(parsed.data) ? parsed.data : [parsed.data]

    const { data, error } = await supabase
      .from("approval_sla_policies")
      .upsert(payload, { onConflict: "stage" })
      .select()

    if (error) return NextResponse.json({ error: "Failed to save SLA policy" }, { status: 500 })
    return NextResponse.json({ data, message: "SLA policy saved" })
  } catch {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

// POST kept for backwards compat — prefer PATCH
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`hr-leave-sla:${getClientId(request)}`, { limit: 15, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  return PATCH(request)
}
