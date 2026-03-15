"use client"

import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { PageLoader, QueryError, EmptyState as QEmptyState } from "@/components/ui/query-states"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, CreditCard, Clock, CheckCircle, AlertCircle, Package, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"

interface FinanceStats {
  totalPayments: number
  pendingPayments: number
  paidPayments: number
  totalAmount: number
  recurringPayments: number
  overduePayments: number
}

async function fetchPayments(): Promise<any[]> {
  const response = await fetch("/api/payments")
  if (!response.ok) throw new Error("Failed to load finance data")
  const payload = await response.json()
  return payload.data || []
}

export function FinanceDashboardContent() {
  const {
    data: allPayments = [],
    isLoading: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.payments(),
    queryFn: fetchPayments,
  })

  const stats: FinanceStats = {
    totalPayments: allPayments.length,
    pendingPayments: allPayments.filter((p: any) => p.status === "pending" || p.status === "due").length,
    paidPayments: allPayments.filter((p: any) => p.status === "paid").length,
    totalAmount: allPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
    recurringPayments: allPayments.filter((p: any) => p.payment_type === "recurring").length,
    overduePayments: allPayments.filter((p: any) => p.status === "overdue").length,
  }

  const recentPayments = allPayments.slice(0, 5)

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
        description="Manage finance modules: Payments, Inventory, and Purchasing"
        icon={DollarSign}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
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
      <Section title="Finance Modules">
        <div className="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {/* Payments Folder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payments
              </CardTitle>
              <CardDescription>Manage department payments and related finance records</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/finance/payments">
                <Button className="w-full">Open Payments ({stats.totalPayments})</Button>
              </Link>
              <Link href="/admin/finance/payments">
                <Button className="w-full" variant="outline">
                  By Department
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Inventory Folder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Inventory
              </CardTitle>
              <CardDescription>Manage products, stock levels, categories, and warehouses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/inventory">
                <Button className="w-full">Open Inventory</Button>
              </Link>
              <Link href="/admin/inventory/products">
                <Button className="w-full" variant="outline">
                  Products
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Purchasing Folder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Purchasing
              </CardTitle>
              <CardDescription>Manage suppliers, purchase orders, and goods receipts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/purchasing">
                <Button className="w-full">Open Purchasing</Button>
              </Link>
              <Link href="/admin/purchasing/orders">
                <Button className="w-full" variant="outline">
                  Purchase Orders
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
              <PageLoader />
            ) : isError ? (
              <QEmptyState message="Could not load payment data." />
            ) : recentPayments.length === 0 ? (
              <EmptyState
                title="No payments found"
                description="Recent payment activity will appear here once transactions are recorded."
                icon={CreditCard}
                className="border-0"
              />
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
