"use client"

import Link from "next/link"
import { ArrowUpRight, Building2, Calendar, Clock, FileText, Layers, User, Wallet } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg md:max-w-xl">
        <SheetHeader className="space-y-3 border-b p-5 pb-4">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <Badge variant="outline" className={`text-xs ${KIND_CLASSES[item.kind]}`}>
              {MD_DESK_QUEUE_LABELS[item.kind]}
            </Badge>
            {item.urgent && (
              <Badge variant="destructive" className="text-xs">
                Emergency
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            <SheetTitle className="text-lg leading-tight font-bold">{item.title}</SheetTitle>
            <SheetDescription className="text-xs">
              Waiting since {formatWATDate(item.waiting_since)} ({formatWATRelative(item.waiting_since)})
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {typeof item.amount === "number" && (
            <div className="bg-card flex items-center justify-between rounded-lg border p-4 shadow-sm">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Amount</p>
                <p className="text-foreground text-2xl font-extrabold">{naira.format(item.amount)}</p>
              </div>
              <div className="bg-primary/10 text-primary rounded-full p-2.5">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          )}

          <div className="bg-card space-y-4 rounded-lg border p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="text-muted-foreground h-4 w-4" />
              Item Information
            </h3>
            <Separator />
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <User className="h-3.5 w-3.5" />
                  Requester / Originator
                </dt>
                <dd className="mt-1 font-medium">{item.requester}</dd>
              </div>

              <div>
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Building2 className="h-3.5 w-3.5" />
                  Department
                </dt>
                <dd className="mt-1 font-medium">{item.department || "—"}</dd>
              </div>

              <div>
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  Waiting Duration
                </dt>
                <dd className="mt-1 font-medium">{formatWATRelative(item.waiting_since)}</dd>
              </div>

              <div>
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Calendar className="h-3.5 w-3.5" />
                  Submission Date
                </dt>
                <dd className="mt-1 font-medium">{formatWATDate(item.waiting_since)}</dd>
              </div>
            </dl>

            {item.detail && (
              <div className="border-t pt-2">
                <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  Details
                </p>
                <p className="bg-muted/40 rounded border p-3 text-sm leading-relaxed">{item.detail}</p>
              </div>
            )}
          </div>

          <div className="bg-muted/20 space-y-3 rounded-lg border p-4">
            <h4 className="text-sm font-semibold">Ready for Decision?</h4>
            <p className="text-muted-foreground text-xs">
              This request is at the Managing Director stage. Click below to open the dedicated approval view with full
              context and signature controls.
            </p>
            <Button asChild className="w-full gap-2">
              <Link href={item.href}>
                <span>{getActionLabel(item.kind)}</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <SheetFooter className="bg-muted/20 flex flex-row items-center justify-between border-t p-4 sm:justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild size="sm" variant="default" className="gap-1.5">
            <Link href={item.href}>
              <span>Open Screen</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
