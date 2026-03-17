"use client"

import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, AlertCircle, Upload, Receipt, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { EmptyState } from "@/components/ui/patterns"
import type { ScheduleItem, PaymentDocument } from "./payment-types"

interface ScheduleListProps {
  items: ScheduleItem[]
  onUpload: (d: Date, t: "invoice" | "receipt") => void
  onView: (e: React.MouseEvent, doc: PaymentDocument) => void
  onMarkPaid?: (d: Date) => void
  onReplace?: (d: Date, t: "invoice" | "receipt", docId: string) => void
}

export function ScheduleList({ items, onUpload, onView, onMarkPaid, onReplace }: ScheduleListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No schedule items found"
        description="Expected payment periods will appear here after schedule generation."
        icon={Calendar}
        className="border-0 p-3"
      />
    )
  }

  return (
    <div className="divide-y rounded-md border">
      {items.map((item, index) => {
        const invoiceDoc = item.documents.find((d) => d.document_type === "invoice")
        const receiptDoc = item.documents.find((d) => d.document_type === "receipt")

        return (
          <div
            key={index}
            className={cn(
              "flex flex-col justify-between gap-3 p-3 sm:flex-row sm:items-center",
              item.status === "overdue" && "bg-red-50 dark:bg-red-950/20"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "rounded-full p-2",
                  item.status === "paid"
                    ? "bg-green-100 text-green-600 dark:bg-green-900/30"
                    : item.status === "overdue"
                      ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                      : item.status === "due"
                        ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800"
                )}
              >
                {item.status === "paid" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : item.status === "overdue" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{format(item.date, "PPP")}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {item.label}
                  </Badge>
                  {receiptDoc && (
                    <span className="flex items-center gap-0.5 text-xs text-green-600">
                      <Receipt className="h-3 w-3" /> Rec
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="ml-10 flex items-center gap-2 self-start sm:ml-0 sm:self-center">
              {invoiceDoc ? (
                <a
                  href="#"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "flex h-7 items-center gap-1 text-xs text-blue-600"
                  )}
                  onClick={(e) => onView(e, invoiceDoc)}
                >
                  <CheckCircle className="h-3 w-3" /> Invoice
                </a>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 border-dashed text-xs"
                  onClick={() => onUpload(item.date, "invoice")}
                >
                  <Upload className="mr-1 h-3 w-3" /> Invoice
                </Button>
              )}

              {(item.status === "paid" || item.status === "overdue" || item.status === "due") &&
                (receiptDoc ? (
                  <div className="flex items-center gap-1">
                    <a
                      href="#"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "flex h-7 items-center gap-1 text-xs text-green-600"
                      )}
                      onClick={(e) => onView(e, receiptDoc)}
                    >
                      <CheckCircle className="h-3 w-3" /> Receipt
                    </a>
                    {onReplace && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground h-7 text-xs"
                        onClick={() => onReplace(item.date, "receipt", receiptDoc.id)}
                      >
                        Replace
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 border-dashed text-xs",
                      item.status === "overdue" && "border-red-300 text-red-600 hover:bg-red-50"
                    )}
                    onClick={() => onUpload(item.date, "receipt")}
                  >
                    <Upload className="mr-1 h-3 w-3" /> Receipt
                  </Button>
                ))}

              {(item.status === "overdue" || item.status === "due") && onMarkPaid && receiptDoc && (
                <Button size="sm" className="h-7 text-xs" onClick={() => onMarkPaid(item.date)}>
                  Mark Paid
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
