"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { CreditCard, FileText, Satellite } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { toLocalISODate } from "@/lib/utils/date"
import { projectPaymentStatus, type ProjectPaymentRow, type ProjectPaymentsData } from "@/lib/projects/project-payments"

const STATUS_CLASSES = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  due: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
} as const

async function fetchProjectPayments(projectId: string): Promise<ProjectPaymentsData> {
  const res = await apiFetch(`/api/projects/${projectId}/payments`)
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || "Failed to load payments")
  return json.data as ProjectPaymentsData
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: currency || "NGN" }).format(amount)
}

function receiptCount(payment: ProjectPaymentRow) {
  return payment.documents.filter((d) => d.document_type === "receipt").length
}

/**
 * The money side of a project: the Starlink kits that serve it and every payment
 * charged to it, each linking through to its invoices and receipts.
 */
export function ProjectPaymentsCard({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["project-payments", projectId],
    queryFn: () => fetchProjectPayments(projectId),
  })

  const kits = data?.kits ?? []
  const payments = data?.payments ?? []
  const today = toLocalISODate()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Starlink &amp; Payments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="bg-muted/40 h-20 animate-pulse rounded-lg" />
        ) : error ? (
          <p className="text-muted-foreground text-sm">
            {error instanceof Error ? error.message : "Couldn't load payments."}
          </p>
        ) : kits.length === 0 && payments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No Starlink kit or payments are linked to this project yet.</p>
        ) : (
          <>
            {kits.length > 0 && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {kits.map((kit) => (
                  <li key={kit.id} className="flex min-w-0 items-start gap-2.5 rounded-lg border p-3">
                    <Satellite className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        Starlink · {kit.site_name}
                        {!kit.is_active && <span className="text-muted-foreground font-normal"> (inactive)</span>}
                      </p>
                      {kit.serial_number && (
                        <p className="text-muted-foreground font-mono text-xs break-all">{kit.serial_number}</p>
                      )}
                      {kit.kit_number && (
                        <p className="text-muted-foreground font-mono text-xs break-all">{kit.kit_number}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {payments.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {payments.map((payment) => {
                  const status = projectPaymentStatus(payment, today)
                  const receipts = receiptCount(payment)
                  const nextDue = payment.payment_type === "recurring" ? payment.next_payment_due : null
                  return (
                    <li key={payment.id}>
                      <Link
                        href={`/admin/accounts/payments/${payment.id}`}
                        className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {payment.category} · {payment.title}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {formatMoney(payment.amount, payment.currency)}
                            {payment.payment_type === "recurring" ? " a month" : ""}
                            {nextDue ? ` · next due ${format(parseISO(nextDue), "d MMM yyyy")}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                            <FileText className="h-3.5 w-3.5" />
                            {receipts} {receipts === 1 ? "receipt" : "receipts"}
                          </span>
                          <span className="text-xs font-medium">
                            {formatMoney(payment.amount_paid ?? 0, payment.currency)} paid
                          </span>
                          <Badge className={cn("capitalize", STATUS_CLASSES[status])}>{status}</Badge>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
