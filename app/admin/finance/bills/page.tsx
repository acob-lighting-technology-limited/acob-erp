"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Receipt, Search, Filter, Eye, CheckCircle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { PageWrapper, PageHeader } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

interface Bill {
  id: string
  bill_number: string
  supplier_name: string
  bill_date: string
  due_date: string
  total_amount: number
  amount_paid: number
  balance_due: number
  currency: string
  status: "pending" | "approved" | "paid" | "overdue" | "cancelled"
  created_at: string
}

const statusColors: Record<string, string> = {
  pending: "secondary",
  approved: "default",
  paid: "default",
  overdue: "destructive",
  cancelled: "secondary",
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    fetchBills()
  }, [])

  async function fetchBills() {
    try {
      const supabase = createClient()

      const { data, error } = await supabase.from("bills").select("*").order("created_at", { ascending: false })

      if (error) {
        if (error.code === "42P01") {
          console.log("Bills table does not exist yet")
          setBills([])
          return
        }
        throw error
      }

      setBills(data || [])
    } catch (error) {
      console.error("Error fetching bills:", error)
      toast.error("Failed to load bills")
    } finally {
      setLoading(false)
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
      month: "short",
      day: "numeric",
    })
  }

  const filteredBills = bills.filter((bill) => {
    const matchesSearch =
      bill.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || bill.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const stats = {
    total: bills.length,
    pending: bills.filter((b) => b.status === "pending").length,
    approved: bills.filter((b) => b.status === "approved").length,
    paid: bills.filter((b) => b.status === "paid").length,
    overdue: bills.filter((b) => b.status === "overdue").length,
    totalAmount: bills.reduce((sum, b) => sum + b.total_amount, 0),
    totalPaid: bills.reduce((sum, b) => sum + b.amount_paid, 0),
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Bills"
        description="Track vendor bills and expenses"
        icon={Receipt}
        backLink={{ href: "/admin", label: "Back to Admin" }}
        actions={
          <Link href="/admin/finance/bills/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Bill
            </Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Bills"
          value={stats.total}
          icon={Receipt}
          description={`${stats.pending} pending approval`}
        />
        <StatCard title="Total Owed" value={formatCurrency(stats.totalAmount)} icon={Receipt} description="All bills" />
        <StatCard
          title="Paid"
          value={formatCurrency(stats.totalPaid)}
          icon={Receipt}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
          description={`${stats.paid} bills paid`}
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(stats.totalAmount - stats.totalPaid)}
          icon={Receipt}
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
                placeholder="Search by bill number or supplier..."
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bills Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Bills</CardTitle>
          <CardDescription>
            {filteredBills.length} bill{filteredBills.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : filteredBills.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No bills yet"
              description="Add your first bill to start tracking expenses."
              action={{ label: "Add Bill", href: "/admin/finance/bills/new", icon: Plus }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Bill Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.bill_number}</TableCell>
                    <TableCell>{bill.supplier_name}</TableCell>
                    <TableCell>{formatDate(bill.bill_date)}</TableCell>
                    <TableCell>{formatDate(bill.due_date)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{formatCurrency(bill.total_amount, bill.currency)}</p>
                        {bill.balance_due > 0 && (
                          <p className="text-sm text-orange-600">
                            Due: {formatCurrency(bill.balance_due, bill.currency)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[bill.status] as any} className="capitalize">
                        {bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/finance/bills/${bill.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {bill.status === "approved" && (
                          <Button variant="ghost" size="icon">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
