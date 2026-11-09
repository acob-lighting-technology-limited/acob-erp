import {
  GRANTABLE_EDIT_ROUTES,
  buildAccessContextV2,
  canAccessRouteV2,
  canEditRouteV2,
  isEditOwnerV2,
  type AccessContextV2,
  type AdminRouteKeyV2,
} from "@/lib/admin/policy-v2"

export type EditGrantMode = "grant" | "delegate"

/** A delegation may last at most a year; it must always end. */
export const MAX_DELEGATION_DAYS = 366

export interface EditGrantRequest {
  mode: EditGrantMode
  actorId: string
  actorRole: string
  actorContext: AccessContextV2
  /** Routes the actor holds through an explicit (non-delegated) grant, expiry applied. */
  actorOwnGrantRoutes: AdminRouteKeyV2[]
  targetId: string
  targetRole: string
  targetAdminRoutes: AdminRouteKeyV2[] | null
  routes: AdminRouteKeyV2[]
  validUntil: Date | null
  now: Date
}

const ADMIN_LIKE = ["admin", "super_admin", "developer"]

/** The group's umbrella key: a grant on it covers every route in the group. */
function umbrella(route: AdminRouteKeyV2): AdminRouteKeyV2 | null {
  if (route.startsWith("hr.") || route === "jobdescriptions.main") return "hr.main"
  if (route === "it.main" || route.startsWith("security.")) return "it.main"
  return null
}

/**
 * Why `request` may not be saved, or null when it may.
 *
 *  - Nobody grants or delegates to themselves.
 *  - Only a person with the admin role can hold an /admin grant.
 *  - "grant": developer or super admin only.
 *  - "delegate": the actor must own the route (lead of the owning department) or hold
 *    an explicit grant on it — never a delegation, so access cannot be passed along
 *    a chain — and the delegation must end within MAX_DELEGATION_DAYS.
 *  - Edit never exceeds view: the target must already be able to open the route.
 */
export function checkEditGrantRequest(request: EditGrantRequest): string | null {
  if (request.actorId === request.targetId) return "You cannot give edit access to yourself."
  if (!ADMIN_LIKE.includes(request.targetRole)) {
    return "Only a person with the admin role can hold edit access. Ask a developer or super admin to make them an admin first."
  }
  if (request.routes.length === 0) return "Choose at least one area."
  if (request.routes.some((route) => !GRANTABLE_EDIT_ROUTES.includes(route))) return "That area has no edit level."

  const { now, validUntil } = request
  if (validUntil && validUntil.getTime() <= now.getTime()) return "The end date must be in the future."

  if (request.mode === "grant") {
    if (request.actorRole !== "developer" && request.actorRole !== "super_admin") {
      return "Only a developer or super admin can grant edit access."
    }
  } else {
    if (!validUntil) return "A delegation needs an end date."
    const days = (validUntil.getTime() - now.getTime()) / 86_400_000
    if (days > MAX_DELEGATION_DAYS) return `A delegation can last at most ${MAX_DELEGATION_DAYS} days.`
    for (const route of request.routes) {
      const own =
        isEditOwnerV2(request.actorContext, route) ||
        request.actorOwnGrantRoutes.includes(route) ||
        (umbrella(route) !== null && request.actorOwnGrantRoutes.includes(umbrella(route)!))
      if (!own || !canEditRouteV2(request.actorContext, route)) {
        return "You can only delegate access you hold yourself, and a delegate cannot pass it on."
      }
    }
  }

  const targetContext = buildAccessContextV2({
    role: request.targetRole,
    isDepartmentLead: false,
    isAdminLike: true,
    adminRoutes: request.targetAdminRoutes,
    scopeMode: "global",
    managedDepartments: [],
  })
  const missing = request.routes.find((route) => !canAccessRouteV2(targetContext, route))
  if (missing) return "They cannot open that area yet. A developer or super admin must give them view access first."

  return null
}

/** Whether `actorId` may withdraw a grant row. */
export function canRevokeEditGrant(params: {
  actorId: string
  actorRole: string
  row: { granted_by: string | null; delegated_from: string | null }
}): boolean {
  if (params.actorRole === "developer" || params.actorRole === "super_admin") return true
  return params.row.granted_by === params.actorId || params.row.delegated_from === params.actorId
}
