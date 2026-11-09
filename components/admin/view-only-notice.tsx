import { Eye, ShieldAlert, UserCheck } from "lucide-react"
import { getRequestScope } from "@/lib/admin/api-scope"
import { editRouteLabel } from "@/lib/admin/edit-route-labels"
import { loadEditHolders } from "@/lib/admin/edit-holders"
import {
  CS_EDIT_ROUTES,
  MD_EDIT_ROUTES,
  EDIT_AREA_LABELS,
  EDIT_GUARDED_ROUTES,
  HR_EDIT_ROUTES,
  IT_EDIT_ROUTES,
  canEditRouteV2,
  buildAccessContextV2,
  canAccessRouteV2,
  editAreaFor,
  editModeV2,
  type AdminRouteKeyV2,
} from "@/lib/admin/policy-v2"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { formatWATDate } from "@/lib/utils/date"

export type GuardedUmbrella = "hr.main" | "it.main" | "scorecard.main" | "mddesk.main"

interface ViewOnlyNoticeProps {
  /** The group's umbrella key. */
  route: GuardedUmbrella
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  return formatWATDate(value)
}

function groupRoutes(route: GuardedUmbrella): AdminRouteKeyV2[] {
  if (route === "hr.main") return HR_EDIT_ROUTES
  if (route === "it.main") return IT_EDIT_ROUTES
  if (route === "mddesk.main") return MD_EDIT_ROUTES
  return CS_EDIT_ROUTES
}

function areaName(route: GuardedUmbrella) {
  const area = editAreaFor(route)
  return area ? EDIT_AREA_LABELS[area] : ""
}

/**
 * Tells someone who can open a guarded page about their edit position:
 *   - view only: who can change things;
 *   - acting for an owner (a delegate): until when;
 *   - an override: that they can change things but every change is marked and shown to the owners.
 * Renders nothing for owners. Server-side, so names are live and the notice cannot be dismissed by
 * editing the page. The server enforces the same rule on every change.
 */
export async function ViewOnlyNotice({ route }: ViewOnlyNoticeProps) {
  const scope = await getRequestScope()
  if (!scope || !scope.isAdminLike) return null

  const context = buildAccessContextV2(scope)
  const group = groupRoutes(route)
  const viewable = group.filter((key) => canAccessRouteV2(context, key))
  if (viewable.length === 0) return null

  const mode = editModeV2(context, route)
  if (mode === "owner") return null

  const supabase = await createClient()
  const holders = await loadEditHolders(getServiceRoleClientOrFallback(supabase), route)

  if (mode === "override") {
    const owners = holders.filter((holder) => holder.via === "owner").map((holder) => holder.name)
    return (
      <div className="border-warning/40 bg-warning/10 text-foreground mx-4 mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm md:mx-6">
        <ShieldAlert className="text-warning mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-medium">You are using override access on {areaName(route)}.</span> You can change things
          here, but every change is recorded as an override and shown to the owner
          {owners.length === 1 ? "" : "s"}
          {owners.length > 0 ? ` (${owners.join(", ")})` : ""}.
        </p>
      </div>
    )
  }

  const editable = viewable.filter((key) => EDIT_GUARDED_ROUTES.includes(key) && canEditRouteV2(context, key))
  const mine = holders.find((holder) => holder.userId === scope.userId && holder.via === "delegate")

  if (mode === "delegate" || editable.length > 0) {
    const canEditAll = mode === "delegate"
    return (
      <div className="bg-muted/50 text-muted-foreground mx-4 mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm md:mx-6">
        <UserCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {mine ? (
            <>
              You are acting for {mine.delegatedFromName ?? "an owner"}
              {mine.validUntil ? ` until ${formatDate(mine.validUntil)}` : ""}.{" "}
            </>
          ) : null}
          {canEditAll
            ? "Changes you make are recorded as made on their behalf."
            : `You can change: ${editable.map((key) => editRouteLabel(key)).join(", ")}. Everything else here is view only.`}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-muted/50 text-muted-foreground mx-4 mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm md:mx-6">
      <Eye className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="text-foreground font-medium">View only.</span> Changes here are made by an owner of{" "}
        {areaName(route)}, or someone they have delegated to.
      </p>
    </div>
  )
}
