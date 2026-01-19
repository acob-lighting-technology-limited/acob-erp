"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Download, Send, Printer, CheckCircle, Pencil } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface Invoice {
  id: string
  invoice_number: string
  customer_name: string
  customer_email: string | null
  customer_address: string | null
  issue_date: string
  due_date: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  amount_paid: number
  balance_due: number
  currency: string
  status: string
  notes: string | null
  terms: string | null
  created_at: string
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  amount: number
}

const statusColors: Record<string, string> = {
  draft: "secondary",
  sent: "default",
  paid: "default",
  overdue: "destructive",
  cancelled: "secondary",
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInvoice()
  }, [params.id])

  async function fetchInvoice() {
    try {
      const supabase = createClient()

      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", params.id)
        .single()

      if (invoiceError) throw invoiceError

      const { data: itemsData, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", params.id)
        .order("created_at")

      if (itemsError) throw itemsError

      setInvoice(invoiceData)
      setItems(itemsData || [])
    } catch (error) {
      console.error("Error fetching invoice:", error)
      toast.error("Failed to load invoice")
    } finally {
      setLoading(false)
    }
  }

  async function markAsSent() {
    if (!invoice) return

    try {
      const supabase = createClient()

      const { error } = await supabase.from("invoices").update({ status: "sent" }).eq("id", invoice.id)

      if (error) throw error

      toast.success("Invoice marked as sent")
      fetchInvoice()
    } catch (error) {
      console.error("Error updating invoice:", error)
      toast.error("Failed to update invoice")
    }
  }

  async function markAsPaid() {
    if (!invoice) return

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          amount_paid: invoice.total_amount,
          balance_due: 0,
        })
        .eq("id", invoice.id)

      if (error) throw error

      toast.success("Invoice marked as paid")
      fetchInvoice()
    } catch (error) {
      console.error("Error updating invoice:", error)
      toast.error("Failed to update invoice")
    }
  }

  function formatCurrency(amount: number, currency: string = "NGN") {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency,
    }).format(amount)
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold">Invoice not found</h1>
        <Link href="/admin/finance/invoices">
          <Button className="mt-4">Back to Invoices</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/finance/invoices" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">{invoice.invoice_number}</h1>
            <Badge variant={statusColors[invoice.status] as any} className="ml-2 capitalize">
              {invoice.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">Created on {formatDate(invoice.created_at)}</p>
        </div>
        <div className="flex gap-2">
          {invoice.status === "draft" && (
            <>
              <Link href={`/admin/finance/invoices/${invoice.id}/edit`}>
                <Button variant="outline">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <Button onClick={markAsSent}>
                <Send className="mr-2 h-4 w-4" />
                Mark as Sent
              </Button>
            </>
          )}
          {invoice.status === "sent" && (
            <Button onClick={markAsPaid} variant="default">
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark as Paid
            </Button>
          )}
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Invoice Preview */}
      <Card>
        <CardContent className="p-8">
          {/* Header Section */}
          <div className="mb-8 flex justify-between">
            <div>
              <h2 className="mb-2 text-2xl font-bold">INVOICE</h2>
              <p className="text-muted-foreground">{invoice.invoice_number}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">ACOB Lighting Technology</p>
              <p className="text-muted-foreground text-sm">Lagos, Nigeria</p>
            </div>
          </div>

          {/* Bill To & Details */}
          <div className="mb-8 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-muted-foreground mb-2 text-sm font-semibold">BILL TO</h3>
              <p className="font-semibold">{invoice.customer_name}</p>
              {invoice.customer_email && <p className="text-sm">{invoice.customer_email}</p>}
              {invoice.customer_address && (
                <p className="text-muted-foreground text-sm whitespace-pre-line">{invoice.customer_address}</p>
              )}
            </div>
            <div className="text-right">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Issue Date:</span>
                <span>{formatDate(invoice.issue_date)}</span>
                <span className="text-muted-foreground">Due Date:</span>
                <span>{formatDate(invoice.due_date)}</span>
                <span className="text-muted-foreground">Status:</span>
                <span className="font-semibold capitalize">{invoice.status}</span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Items Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unit_price, invoice.currency)}</TableCell>
                  <TableCell className="text-right">{item.tax_rate}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.amount, invoice.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator className="my-6" />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(invoice.discount_amount, invoice.currency)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(invoice.total_amount, invoice.currency)}</span>
              </div>
              {invoice.amount_paid > 0 && (
                <>
                  <div className="flex justify-between text-green-600">
                    <span>Paid</span>
                    <span>-{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Balance Due</span>
                    <span>{formatCurrency(invoice.balance_due, invoice.currency)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <>
              <Separator className="my-6" />
              <div className="grid gap-6 md:grid-cols-2">
                {invoice.notes && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Notes</h3>
                    <p className="text-muted-foreground text-sm">{invoice.notes}</p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Terms & Conditions</h3>
                    <p className="text-muted-foreground text-sm">{invoice.terms}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
