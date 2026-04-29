import { NextResponse } from "next/server"
import { getRequestScope } from "@/lib/admin/api-scope"
import {
  buildAccessContextV2,
  canAccessRouteV2,
  type AccessContextV2,
  type AdminRouteKeyV2,
  type DataScopeV2,
  getDataScopeV2,
  isRbacV2Enabled,
} from "@/lib/admin/policy-v2"

export async function requireAccessContextV2(): Promise<
  { ok: true; context: AccessContextV2 } | { ok: false; response: NextResponse }
> {
  const scope = await getRequestScope()
  if (!scope) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, context: buildAccessContextV2(scope) }
}

export function enforceRouteAccessV2(
  context: AccessContextV2,
  route: AdminRouteKeyV2
): { ok: true; dataScope: DataScopeV2 } | { ok: false; response: NextResponse } {
  if (!isRbacV2Enabled()) {
    return { ok: true, dataScope: "all" }
  }

  if (!canAccessRouteV2(context, route)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, dataScope: getDataScopeV2(context, route) }
}
