"use client"

import { useState } from "react"
import {
  AlertCircle,
  Archive,
  ArrowRight,
  CheckCircle2,
  type LucideIcon,
  Plus,
  RefreshCw,
  UserMinus,
  UserPlus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, formatName } from "@/lib/utils"
import { formatWATDateTime } from "@/lib/utils/date"
import type { AssetActivity, AssetActivityType } from "@/lib/assets/asset-activity"

export const ASSET_ACTIVITY_STYLE: Record<AssetActivityType, { icon: LucideIcon; node: string; badge: string }> = {
  created: { icon: Plus, node: "border-info bg-info text-white", badge: "bg-info/15 text-info" },
  assignment: { icon: UserPlus, node: "border-success bg-success text-white", badge: "bg-success/15 text-success" },
  unassignment: { icon: UserMinus, node: "border-warning bg-warning text-white", badge: "bg-warning/15 text-warning" },
  status_change: { icon: RefreshCw, node: "border-purple bg-purple text-white", badge: "bg-purple/15 text-purple" },
  issue_reported: { icon: AlertCircle, node: "border-danger bg-danger text-white", badge: "bg-danger/15 text-danger" },
  issue_resolved: {
    icon: CheckCircle2,
    node: "border-success bg-success text-white",
    badge: "bg-success/15 text-success",
  },
  archived: {
    icon: Archive,
    node: "border-muted-foreground bg-muted-foreground text-white",
    badge: "bg-muted text-muted-foreground",
  },
}

export function heldFor(days: number): string {
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`
  const months = Math.round(days / 30.4)
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`
  const years = Math.floor(months / 12)
  const rest = months % 12
  return `${years} year${years === 1 ? "" : "s"}${rest ? ` ${rest} month${rest === 1 ? "" : "s"}` : ""}`
}

/** "Available → Assigned", as two small badges. */
export function StatusTransition({ from, to }: { from?: string; to?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <Badge variant="outline" className="font-normal">
        {from ? formatName(from) : "—"}
      </Badge>
      <ArrowRight className="text-muted-foreground h-3 w-3" />
      <Badge variant="outline" className="font-medium">
        {to ? formatName(to) : "—"}
      </Badge>
    </span>
  )
}

/** The second line under an event: who did it and, for a return, how long it was held. */
export function activityMeta(activity: AssetActivity): string {
  const parts: string[] = []
  if (activity.performed_by_name) parts.push(`by ${activity.performed_by_name}`)
  if (activity.type === "unassignment" && activity.details?.held_days) {
    parts.push(`held ${heldFor(activity.details.held_days)}`)
  }
  return parts.join(" • ")
}

function TimelineEntry({ activity }: { activity: AssetActivity }) {
  const style = ASSET_ACTIVITY_STYLE[activity.type]
  const Icon = style.icon
  const meta = activityMeta(activity)
  const quote = activity.details?.notes || activity.description
  return (
    <li className="relative flex gap-3">
      <div
        className={cn(
          "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          style.node
        )}
      >
        <Icon className="h-3 w-3 stroke-[2.5]" />
      </div>
      <div className="min-w-0 flex-1 text-xs">
        <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
          <span className="text-foreground font-medium">{activity.title}</span>
          <span className="text-muted-foreground whitespace-nowrap">{formatWATDateTime(activity.timestamp)}</span>
        </div>
        {meta ? <p className="text-muted-foreground mt-0.5">{meta}</p> : null}
        {activity.type === "status_change" ? (
          <div className="mt-1">
            <StatusTransition from={activity.details?.old_status} to={activity.details?.status} />
          </div>
        ) : null}
        {quote ? (
          <p className="bg-muted/30 mt-1.5 rounded-md border px-2.5 py-1.5 leading-relaxed whitespace-pre-wrap">
            &ldquo;{quote}&rdquo;
          </p>
        ) : null}
      </div>
    </li>
  )
}

/**
 * An asset's events on a vertical line, oldest at the top like the leave and requisition stages,
 * so it reads in the order things happened. `activities` arrive newest first (as
 * buildAssetActivities returns them). With `limit`, only the most recent few show and a button
 * above them opens the earlier ones, so a long-lived laptop does not make its row ten screens tall.
 */
export function AssetTimeline({ activities, limit }: { activities: AssetActivity[]; limit?: number }) {
  const [showAll, setShowAll] = useState(false)
  const chronological = [...activities].reverse()
  const capped = limit !== undefined && !showAll && chronological.length > limit
  const visible = capped ? chronological.slice(-limit) : chronological
  const hidden = chronological.length - visible.length

  return (
    <div className="space-y-2">
      {limit !== undefined && chronological.length > limit ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 px-2 text-xs"
          onClick={() => setShowAll((v) => !v)}
        >
          {capped ? `View ${hidden} earlier event${hidden === 1 ? "" : "s"}` : "Show fewer"}
        </Button>
      ) : null}
      <ol className="before:bg-border relative space-y-3 before:absolute before:top-2.5 before:bottom-2.5 before:left-[9px] before:w-px">
        {visible.map((activity) => (
          <TimelineEntry key={activity.id} activity={activity} />
        ))}
      </ol>
    </div>
  )
}
