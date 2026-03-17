"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TableCell, TableRow } from "@/components/ui/table"
import { Eye, Printer } from "lucide-react"
import { format, parseISO } from "date-fns"

interface PaymentRowData {
  id: string
  payment_type: "one-time" | "recurring"
  title: string
  issuer_name?: string
  issuer_phone_number?: string
  department?: { name: string }
  amount: number
  amountDue: number
  currency: string
  status: string
  next_payment_due?: string
  payment_date?: string
  documents?: { document_type: string }[]
}

interface PaymentTableRowProps {
  payment: PaymentRowData
  index: number
  basePath: string
  onNavigate: (path: string) => void
  onPrintDocument: (payment: PaymentRowData, type: "invoice" | "receipt") => void
  getStatusColor: (status: string) => string
  formatCurrency: (amount: number, currency: string) => string
}

export function PaymentTableRow({
  payment,
  index,
  basePath,
  onNavigate,
  onPrintDocument,
  getStatusColor,
  formatCurrency,
}: PaymentTableRowProps) {
  return (
    <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={() => onNavigate(`${basePath}/${payment.id}`)}>
      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            payment.payment_type === "recurring"
              ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
              : "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400"
          }
        >
          {payment.payment_type === "recurring" ? "Recurring" : "One-time"}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">{payment.title}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{payment.issuer_name || "N/A"}</span>
          <span className="text-muted-foreground text-xs">{payment.issuer_phone_number || ""}</span>
        </div>
      </TableCell>
      <TableCell>{payment.department?.name || "Unknown"}</TableCell>
      <TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
      <TableCell>
        <span
          className={
            payment.status === "overdue"
              ? "font-semibold text-red-600"
              : payment.status === "due"
                ? "font-semibold text-yellow-600"
                : "text-muted-foreground"
          }
        >
          {formatCurrency(payment.amountDue, payment.currency)}
        </span>
      </TableCell>
      <TableCell>
        <Badge className={getStatusColor(payment.status)} variant="outline">
          {payment.status}
        </Badge>
      </TableCell>
      <TableCell>
        {payment.payment_type === "recurring" ? (
          <span className={payment.status === "overdue" ? "font-medium text-red-500" : ""}>
            {payment.next_payment_due ? format(parseISO(payment.next_payment_due), "MMM d, yyyy") : "N/A"}
          </span>
        ) : (
          <span>{payment.payment_date ? format(parseISO(payment.payment_date), "MMM d, yyyy") : "N/A"}</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Print payment" onClick={(e) => e.stopPropagation()}>
                <Printer className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Print Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!payment.documents?.some((d) => d.document_type === "invoice")}
                onClick={() => onPrintDocument(payment, "invoice")}
              >
                Print Invoice
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!payment.documents?.some((d) => d.document_type === "receipt")}
                onClick={() => onPrintDocument(payment, "receipt")}
              >
                Print Receipt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            aria-label="View payment details"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(`${basePath}/${payment.id}`)
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
