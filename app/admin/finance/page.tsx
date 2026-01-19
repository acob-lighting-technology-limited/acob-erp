"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DollarSign,
  FileText,
  Receipt,
  TrendingUp,
  ArrowLeft,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"

interface FinanceStats {
  totalPayments: number
  pendingPayments: number
  paidPayments: number
  totalAmount: number
  recurringPayments: number
  overduePayments: number
}

export default function FinanceDashboard() {
  const [stats, setStats] = useState<FinanceStats>({
    totalPayments: 0,
    pendingPayments: 0,
    paidPayments: 0,
    totalAmount: 0,
    recurringPayments: 0,
    overduePayments: 0,
  })
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFinanceData()
  }, [])

  async function fetchFinanceData() {
    try {
      const supabase = createClient()

      // Fetch all payments
      const { data: payments, error } = await supabase
        .from("department_payments")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error

      const allPayments = payments || []

      // Calculate stats
      const pendingCount = allPayments.filter((p) => p.status === "pending" || p.status === "due").length
      const paidCount = allPayments.filter((p) => p.status === "paid").length
      const recurringCount = allPayments.filter((p) => p.payment_type === "recurring").length
      const overdueCount = allPayments.filter((p) => p.status === "overdue").length
      const totalAmt = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

      setStats({
        totalPayments: allPayments.length,
        pendingPayments: pendingCount,
        paidPayments: paidCount,
        totalAmount: totalAmt,
        recurringPayments: recurringCount,
        overduePayments: overdueCount,
      })

      // Get recent 5 payments
      setRecentPayments(allPayments.slice(0, 5))
    } catch (error) {
      console.error("Error fetching finance data:", error)
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

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Finance</h1>
          </div>
          <p className="text-muted-foreground">Manage payments, invoices, and financial reports</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
            <p className="text-muted-foreground text-xs">Across all payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <CreditCard className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPayments}</div>
            <p className="text-muted-foreground text-xs">{stats.recurringPayments} recurring</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingPayments}</div>
            <p className="text-muted-foreground text-xs">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overduePayments}</div>
            <p className="text-muted-foreground text-xs">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Finance Modules */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payments
            </CardTitle>
            <CardDescription>Manage department payments and bills</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/finance/payments">
              <Button className="w-full">Manage Payments ({stats.totalPayments})</Button>
            </Link>
            <Link href="/admin/finance/payments/departments">
              <Button className="w-full" variant="outline">
                By Department
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoices
            </CardTitle>
            <CardDescription>Create and manage customer invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/finance/invoices">
              <Button className="w-full">Manage Invoices</Button>
            </Link>
            <Link href="/admin/finance/invoices/new">
              <Button className="w-full" variant="outline">
                Create Invoice
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Bills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Bills
            </CardTitle>
            <CardDescription>Track vendor bills and expenses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/finance/bills">
              <Button className="w-full">Manage Bills</Button>
            </Link>
            <Link href="/admin/finance/bills/new">
              <Button className="w-full" variant="outline">
                Add Bill
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Reports
            </CardTitle>
            <CardDescription>Financial analytics and reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/finance/reports">
              <Button className="w-full" variant="outline">
                View Reports
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>Latest payment activity</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
          ) : recentPayments.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">No payments found</div>
          ) : (
            <div className="space-y-4">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div className="flex items-center gap-4">
                    {payment.status === "paid" ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : payment.status === "overdue" ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-orange-500" />
                    )}
                    <div>
                      <p className="font-medium">{payment.title}</p>
                      <p className="text-muted-foreground text-sm">{payment.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(payment.amount || 0, payment.currency)}</p>
                    <p className="text-muted-foreground text-sm capitalize">{payment.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
