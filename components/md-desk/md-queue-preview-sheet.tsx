"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DetailList, SectionHeading } from "@/components/ui/detail-list"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { formatWATDate, formatWATRelative } from "@/lib/utils/date"
import { MD_DESK_QUEUE_LABELS, type MdDeskQueueItem, type MdDeskQueueKind } from "@/lib/md-desk/types"

const KIND_CLASSES: Record<MdDeskQueueKind, string> = {
  leave: "bg-success/10 text-success border-success/20",
  requisition: "bg-warning/10 text-warning border-warning/20",
  correspondence: "bg-info/10 text-info border-info/20",
  task_rating: "bg-purple/10 text-purple border-purple/20",
}

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })

export interface MdQueuePreviewSheetProps {
  item: MdDeskQueueItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getActionLabel(kind: MdDeskQueueKind): string {
  switch (kind) {
    case "leave":
      return "Open in Leave Approvals"
    case "correspondence":
      return "Open in Correspondence"
    case "task_rating":
      return "Rate Task in Task Reviews"
    case "requisition":
      return "Open Requisition"
    default:
      return "Open Approval Screen"
  }
}

export function MdQueuePreviewSheet({ item, open, onOpenChange }: MdQueuePreviewSheetProps) {
  if (!item) return null

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item.title}
      description={`Waiting since ${formatWATDate(item.waiting_since)} (${formatWATRelative(item.waiting_since)})`}
      badges={
        <>
          <Badge variant="outline" className={`text-xs ${KIND_CLASSES[item.kind]}`}>
            {MD_DESK_QUEUE_LABELS[item.kind]}
          </Badge>
          {item.urgent && (
            <Badge variant="destructive" className="text-xs">
              Emergency
            </Badge>
          )}
        </>
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link href={item.href}>
              {getActionLabel(item.kind)}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SectionHeading title="Item information" />
        <DetailList
          items={[
            { label: "Requester", value: item.requester },
            { label: "Department", value: item.department },
            { label: "Waiting", value: formatWATRelative(item.waiting_since) },
            { label: "Submitted", value: formatWATDate(item.waiting_since) },
            ...(typeof item.amount === "number" ? [{ label: "Amount", value: naira.format(item.amount) }] : []),
            ...(item.detail ? [{ label: "Details", value: item.detail, wide: true }] : []),
          ]}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        This request is at the Managing Director stage. Open the approval view for full context and signature controls.
      </p>
    </DetailSheet>
  )
}
