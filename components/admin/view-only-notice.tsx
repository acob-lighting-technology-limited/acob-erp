import { Eye, UserCheck } from "lucide-react"
import { getRequestScope } from "@/lib/admin/api-scope"
import { editRouteLabel } from "@/lib/admin/edit-route-labels"
import { loadEditHolders, type EditHolder } from "@/lib/admin/edit-holders"
import {
  EDIT_GUARDED_ROUTES,
  HR_EDIT_ROUTES,
  IT_EDIT_ROUTES,
  canEditRouteV2,
  buildAccessContextV2,
  canAccessRouteV2,
  type AdminRouteKeyV2,
} from "@/lib/admin/policy-v2"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

interface ViewOnlyNoticeProps {
  /** The group's umbrella key: "hr.main" or "it.main". */
  route: "hr.main" | "it.main"
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function describeHolders(holders: EditHolder[]) {
  const names = Array.from(new Set(holders.map((holder) => holder.name)))
  if (names.length === 0) return "the lead of the owning department"
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`
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
        <span className="text-foreground font-medium">View only.</span> Changes here are made by{" "}
        {describeHolders(holders)}, or someone they have delegated to.
      </p>
    </div>
  )
}
