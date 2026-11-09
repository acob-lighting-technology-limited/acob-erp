import { getRequestScope } from "@/lib/admin/api-scope"
import { EditAccessProvider } from "@/components/admin/edit-access-context"
import { ViewOnlyNotice, type GuardedUmbrella } from "@/components/admin/view-only-notice"
import {
  CS_EDIT_ROUTES,
  MD_EDIT_ROUTES,
  EDIT_GUARDED_ROUTES,
  HR_EDIT_ROUTES,
  IT_EDIT_ROUTES,
  buildAccessContextV2,
  canEditRouteV2,
  editModeV2,
  type AdminRouteKeyV2,
} from "@/lib/admin/policy-v2"

interface EditAccessBoundaryProps {
  /** The group's umbrella key: "hr.main", "it.main" or "scorecard.main". */
  route: GuardedUmbrella
  children: React.ReactNode
}

function groupOf(route: GuardedUmbrella): AdminRouteKeyV2[] {
  if (route === "hr.main") return HR_EDIT_ROUTES
  if (route === "it.main") return IT_EDIT_ROUTES
  if (route === "mddesk.main") return MD_EDIT_ROUTES
  return CS_EDIT_ROUTES
}

/**
 * Wraps a guarded layout (HR, PMS, IT, Corporate Services): shows the notice for this person's edit
 * position (view only, acting for an owner, or override) and tells the screens below what they may
 * change, so they can leave out the buttons that would be refused.
 */
export async function EditAccessBoundary({ route, children }: EditAccessBoundaryProps) {
  const scope = await getRequestScope()
  let editable: "all" | string[] = "all"
  let override = false

  if (scope?.isAdminLike) {
    const context = buildAccessContextV2(scope)
    override = editModeV2(context, route) === "override"
    if (!canEditRouteV2(context, route)) {
      editable = groupOf(route).filter((key) => EDIT_GUARDED_ROUTES.includes(key) && canEditRouteV2(context, key))
    }
  }

  return (
    <EditAccessProvider editable={editable} override={override}>
      <ViewOnlyNotice route={route} />
      {children}
    </EditAccessProvider>
  )
}
