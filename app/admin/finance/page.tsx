"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, FileText, Receipt, TrendingUp, CreditCard, Clock, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"

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

      const { data: payments, error } = await supabase
        .from("department_payments")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error

      const allPayments = payments || []

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
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Finance"
        description="Manage payments, invoices, and financial reports"
        icon={DollarSign}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Amount"
          value={formatCurrency(stats.totalAmount)}
          icon={DollarSign}
          description="Across all payments"
        />
        <StatCard
          title="Total Payments"
          value={stats.totalPayments}
          icon={CreditCard}
          description={`${stats.recurringPayments} recurring`}
        />
        <StatCard
          title="Pending"
          value={stats.pendingPayments}
          icon={Clock}
          iconBgColor="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
          description="Awaiting payment"
        />
        <StatCard
          title="Overdue"
          value={stats.overduePayments}
          icon={AlertCircle}
          iconBgColor="bg-red-100 dark:bg-red-900/30"
          iconColor="text-red-600 dark:text-red-400"
          description="Require attention"
        />
      </div>

      {/* Finance Modules */}
      <Section title="Finance Management">
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
      </Section>

      {/* Recent Payments */}
      <Section title="Recent Payments">
        <Card>
          <CardContent className="pt-6">
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
      </Section>
    </PageWrapper>
  )
}
