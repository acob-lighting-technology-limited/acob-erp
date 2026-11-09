import { getRequestScope } from "@/lib/admin/api-scope"
import { EditAccessProvider } from "@/components/admin/edit-access-context"
import { ViewOnlyNotice } from "@/components/admin/view-only-notice"
import {
  EDIT_GUARDED_ROUTES,
  HR_EDIT_ROUTES,
  IT_EDIT_ROUTES,
  buildAccessContextV2,
  canEditRouteV2,
  type AdminRouteKeyV2,
} from "@/lib/admin/policy-v2"

interface EditAccessBoundaryProps {
  /** The group's umbrella key: "hr.main" or "it.main". */
  route: "hr.main" | "it.main"
  children: React.ReactNode
}

/**
 * Wraps an HR, PMS or IT layout: shows the view-only notice and tells the screens below
 * what this person may change, so they can leave out the buttons that would be refused.
 */
export async function EditAccessBoundary({ route, children }: EditAccessBoundaryProps) {
  const scope = await getRequestScope()
  let editable: "all" | string[] = "all"

  if (scope?.isAdminLike) {
    const context = buildAccessContextV2(scope)
    if (!canEditRouteV2(context, route)) {
      const group: AdminRouteKeyV2[] = route === "hr.main" ? HR_EDIT_ROUTES : IT_EDIT_ROUTES
      editable = group.filter((key) => EDIT_GUARDED_ROUTES.includes(key) && canEditRouteV2(context, key))
    }
  }

  return (
    <EditAccessProvider editable={editable}>
      <ViewOnlyNotice route={route} />
      {children}
    </EditAccessProvider>
  )
}
