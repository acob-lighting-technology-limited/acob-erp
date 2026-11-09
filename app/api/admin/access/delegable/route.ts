import { NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { loadDelegableRoutes } from "@/lib/admin/delegable-routes"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/access/delegable")
export const dynamic = "force-dynamic"

/** The edit-guarded areas the caller may hand on to a delegate. Empty for most people. */
export async function GET() {
  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  const { scope, supabase } = auth

  try {
    return NextResponse.json({ data: await loadDelegableRoutes(supabase, scope.userId) })
  } catch (error) {
    return serverError(log, error)
  }
}
