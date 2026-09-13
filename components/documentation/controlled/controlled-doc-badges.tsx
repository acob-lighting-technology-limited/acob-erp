import { CheckCircle2, CircleAlert, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CONTROLLED_DOC_STATUS_LABELS,
  getReviewState,
  type ControlledDocRow,
  type ControlledDocStatus,
} from "@/lib/documentation/controlled"

const STATUS_CLASSES: Record<ControlledDocStatus, string> = {
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  retired: "border-muted-foreground/30 bg-muted text-muted-foreground",
}

export function ControlledDocStatusBadge({ status }: { status: ControlledDocStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs", STATUS_CLASSES[status])}>
      {CONTROLLED_DOC_STATUS_LABELS[status]}
    </Badge>
  )
}

export function ReviewDateBadge({ date }: { date: string | null }) {
  const state = getReviewState(date)
  if (state === "none" || !date) return <span className="text-muted-foreground text-xs">—</span>

  const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  if (state === "ok") return <span className="text-xs">{label}</span>

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        state === "overdue"
          ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      )}
    >
      {state === "overdue" ? "Overdue" : "Due"} · {label}
    </Badge>
  )
}

/** The caller's own acknowledgement state for a policy. */
export function MyAcknowledgementBadge({ doc }: { doc: Pick<ControlledDocRow, "my_acknowledged_at"> }) {
  if (doc.my_acknowledged_at) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-400"
      >
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Acknowledged
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400">
      <CircleAlert className="mr-1 h-3 w-3" />
      Action needed
    </Badge>
  )
}

/** Organisation-level acknowledgement progress for a published policy. */
export function AcknowledgementProgress({ progress }: { progress: ControlledDocRow["acknowledgement"] }) {
  if (!progress) return <span className="text-muted-foreground text-xs">—</span>
  const percent = progress.total > 0 ? Math.round((progress.acknowledged / progress.total) * 100) : 0
  const complete = progress.total > 0 && progress.acknowledged >= progress.total
  return (
    <div className="flex min-w-[120px] flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs">
        {complete ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Clock className="text-muted-foreground h-3.5 w-3.5" />
        )}
        <span className="font-medium">
          {progress.acknowledged}/{progress.total}
        </span>
        <span className="text-muted-foreground">({percent}%)</span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full", complete ? "bg-emerald-500" : "bg-blue-500")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
