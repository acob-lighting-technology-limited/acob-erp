"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Receipt } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { STATUS_LABELS, formatNaira } from "@/lib/requisitions/format"
import { FORM_LABELS } from "@/lib/requisitions/limits"
import type { RequisitionFormType, RequisitionStatus } from "@/lib/requisitions/types"
import { NewRequisitionDialog } from "./new-requisition-dialog"

import { apiFetch } from "@/lib/api-client"
interface LinkedRequisition {
  id: string
  requisition_number: string
  form_type: RequisitionFormType
  amount: number
  amount_paid: number
  status: RequisitionStatus
  requester: { full_name: string | null } | null
}

/**
 * On a help desk ticket: anything that needs buying is raised as a
 * requisition from here, and its progress shows on the ticket.
 */
export function TicketRequisitionsCard({
  ticket,
  canRaise,
}: {
  ticket: { id: string; ticket_number: string; title: string }
  canRaise: boolean
}) {
  const [rows, setRows] = useState<LinkedRequisition[]>([])
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/help-desk/tickets/${ticket.id}/requisitions`)
    if (!res.ok) return
    const json = await res.json()
    setRows(json.data || [])
  }, [ticket.id])

  useEffect(() => {
    load()
  }, [load])

  if (!rows.length && !canRaise) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Requisitions</CardTitle>
        {canRaise ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Receipt className="mr-1.5 h-4 w-4" /> Raise requisition
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length ? (
          rows.map((r) => (
            <Link
              key={r.id}
              href={`/accounts/requisitions/${r.id}`}
              className="hover:bg-muted flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="font-mono font-semibold">{r.requisition_number}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {FORM_LABELS[r.form_type]} · {formatNaira(r.amount)} · {r.requester?.full_name}
                </span>
              </span>
              <Badge variant="secondary" className="shrink-0">
                {STATUS_LABELS[r.status]}
              </Badge>
            </Link>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">
            Needs something bought or paid for? Raise a Payment Request or Petty Cash from here and it will be linked to
            this ticket.
          </p>
        )}
      </CardContent>
      <NewRequisitionDialog open={open} onOpenChange={setOpen} helpDeskTicket={ticket} onSuccess={load} />
    </Card>
  )
}
