import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getRequestScope } from "@/lib/admin/api-scope"
import { canAccessAdminSection } from "@/lib/admin/rbac"
import { createClient } from "@/lib/supabase/server"

const CollectorTokenSchema = z.object({ managementToken: z.string().trim().min(20).max(500) })

type CollectorConfigClient = {
  rpc: (
    fn: "set_error_monitor_management_token",
    args: { p_token: string }
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>
}

export async function POST(request: NextRequest) {
  const scope = await getRequestScope()
  if (!scope?.isAdminLike || !canAccessAdminSection(scope, "dev"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const parsed = CollectorTokenSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid token" }, { status: 400 })

  const client = (await createClient()) as unknown as CollectorConfigClient
  const { error } = await client.rpc("set_error_monitor_management_token", { p_token: parsed.data.managementToken })
  if (error) return NextResponse.json({ error: "Unable to save collector token" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
