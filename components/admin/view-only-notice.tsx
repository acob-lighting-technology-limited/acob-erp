import { Eye, UserCheck } from "lucide-react"
import { getRequestScope } from "@/lib/admin/api-scope"
import { editRouteLabel } from "@/lib/admin/edit-route-labels"
import { loadEditHolders } from "@/lib/admin/edit-holders"
import {
  EDIT_GUARDED_ROUTES,
  EDIT_OWNER_DEPARTMENTS,
  HR_EDIT_ROUTES,
  IT_EDIT_ROUTES,
  canEditRouteV2,
  buildAccessContextV2,
  canAccessRouteV2,
  type AdminRouteKeyV2,
} from "@/lib/admin/policy-v2"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { formatWATDate } from "@/lib/utils/date"

interface ViewOnlyNoticeProps {
  /** The group's umbrella key: "hr.main" or "it.main". */
  route: "hr.main" | "it.main"
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  return formatWATDate(value)
}

/** Positions, not people: "Admin and HR Lead, Corporate Services Lead". */
function describeOwners(route: "hr.main" | "it.main") {
  const departments = route === "hr.main" ? EDIT_OWNER_DEPARTMENTS.hr : EDIT_OWNER_DEPARTMENTS.it
  return departments.map((department) => `${department} Lead`).join(", ")
}

/**
 * Tells someone who can open an HR or IT page but cannot change it, and who can.
 * Renders nothing for people who may edit. Server-side, so the names are live (a new
 * lead or a fresh delegation shows up straight away) and the notice cannot be
 * dismissed by editing the page. The server enforces the same rule on every change.
 */
export async function ViewOnlyNotice({ route }: ViewOnlyNoticeProps) {
  const scope = await getRequestScope()
  if (!scope || !scope.isAdminLike) return null

  const context = buildAccessContextV2(scope)
  const group: AdminRouteKeyV2[] = route === "hr.main" ? HR_EDIT_ROUTES : IT_EDIT_ROUTES
  const viewable = group.filter((key) => canAccessRouteV2(context, key))
  if (viewable.length === 0) return null

  const canEditAll = canEditRouteV2(context, route)
  if (canEditAll) return null

  const editable = viewable.filter((key) => EDIT_GUARDED_ROUTES.includes(key) && canEditRouteV2(context, key))
  const supabase = await createClient()
  const holders = await loadEditHolders(getServiceRoleClientOrFallback(supabase), route)
  const mine = holders.find((holder) => holder.userId === scope.userId && holder.via === "delegate")

  if (editable.length > 0) {
    return (
      <div className="bg-muted/50 text-muted-foreground mx-4 mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm md:mx-6">
        <UserCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {mine ? (
            <>
              You are acting for {mine.delegatedFromName ?? "a lead"}
              {mine.validUntil ? ` until ${formatDate(mine.validUntil)}` : ""}.{" "}
            </>
          ) : null}
          You can change: {editable.map((key) => editRouteLabel(key)).join(", ")}. Everything else here is view only.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-muted/50 text-muted-foreground mx-4 mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm md:mx-6">
      <Eye className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="text-foreground font-medium">View only.</span> Changes here are made by {describeOwners(route)}
        , or someone they have delegated to.
      </p>
    </div>
  )
}
