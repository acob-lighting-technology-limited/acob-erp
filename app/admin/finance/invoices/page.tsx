"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, FileText, Search, Filter, Eye, Download, Send } from "lucide-react"
import Link from "next/link"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { TableSkeleton } from "@/components/ui/query-states"

import { logger } from "@/lib/logger"

const log = logger("finance-invoices")

async function fetchInvoicesList(): Promise<Invoice[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false })
  if (error) {
    if (error.code === "42P01") {
      log.debug("Invoices table does not exist yet")
      return []
    }
    throw new Error(error.message)
  }
  return data || []
}

interface Invoice {
  id: string
  invoice_number: string
  customer_name: string
  customer_email: string | null
  issue_date: string
  due_date: string
  total_amount: number
  amount_paid: number
  balance_due: number
  currency: string
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
  created_at: string
}

type InvoiceStatusVariant = "default" | "destructive" | "secondary" | "outline"

const statusColors: Record<Invoice["status"], InvoiceStatusVariant> = {
  draft: "secondary",
  sent: "default",
  paid: "default",
  overdue: "destructive",
  cancelled: "secondary",
}

export default function InvoicesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const { data: invoices = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminInvoices(),
    queryFn: fetchInvoicesList,
  })

  function formatCurrency(amount: number, currency: string = "NGN") {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency,
    }).format(amount)
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer_name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const stats = {
    total: invoices.length,
    draft: invoices.filter((i) => i.status === "draft").length,
    sent: invoices.filter((i) => i.status === "sent").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    overdue: invoices.filter((i) => i.status === "overdue").length,
    totalAmount: invoices.reduce((sum, i) => sum + i.total_amount, 0),
    totalPaid: invoices.reduce((sum, i) => sum + i.amount_paid, 0),
  }

  return (
    <AdminTablePage
      title="Invoices"
      description="Create and manage customer invoices"
      icon={FileText}
      backLinkHref="/admin"
      backLinkLabel="Back to Admin"
      actions={
        <Link href="/admin/finance/invoices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </Link>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
        <StatCard title="Total Invoices" value={stats.total} icon={FileText} description={`${stats.draft} drafts`} />
        <StatCard title="Total Amount" value={formatCurrency(stats.totalAmount)} icon={FileText} />
        <StatCard
          title="Collected"
          value={formatCurrency(stats.totalPaid)}
          icon={FileText}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
          description={`${stats.paid} paid invoices`}
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(stats.totalAmount - stats.totalPaid)}
          icon={FileText}
          iconBgColor="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
          description={`${stats.overdue} overdue`}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by invoice number or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="Create your first invoice to start tracking revenue."
              action={{ label: "Create Invoice", href: "/admin/finance/invoices/new", icon: Plus }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.customer_name}</p>
                        {invoice.customer_email && (
                          <p className="text-muted-foreground text-sm">{invoice.customer_email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                    <TableCell>{formatDate(invoice.due_date)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{formatCurrency(invoice.total_amount, invoice.currency)}</p>
                        {invoice.balance_due > 0 && (
                          <p className="text-sm text-orange-600">
                            Due: {formatCurrency(invoice.balance_due, invoice.currency)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[invoice.status]} className="capitalize">
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/finance/invoices/${invoice.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {invoice.status === "draft" && (
                          <Button variant="ghost" size="icon">
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminTablePage>
  )
}
