"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3 } from "lucide-react"
import { PageLoader } from "@/components/ui/query-states"

interface ReportData {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  paymentsByMonth: { month: string; amount: number }[]
  paymentsByCategory: { category: string; amount: number }[]
}

async function fetchFinanceReportData(): Promise<ReportData> {
  const supabase = createClient()

  const { data: payments, error } = await supabase
    .from("department_payments")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    if (error.code === "42P01") {
      return { totalRevenue: 0, totalExpenses: 0, netIncome: 0, paymentsByMonth: [], paymentsByCategory: [] }
    }
    throw new Error(error.message)
  }

  const allPayments = payments || []

  const totalExpenses = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

  const categoryMap = new Map<string, number>()
  allPayments.forEach((p) => {
    const cat = p.category || "Other"
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + (p.amount || 0))
  })
  const paymentsByCategory = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)

  const monthMap = new Map<string, number>()
  allPayments.forEach((p) => {
    const date = new Date(p.created_at)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + (p.amount || 0))
  })
  const paymentsByMonth = Array.from(monthMap.entries())
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)

  return {
    totalRevenue: 0, // Would come from invoices
    totalExpenses,
    netIncome: -totalExpenses, // Simplified
    paymentsByMonth,
    paymentsByCategory,
  }
}

export default function FinanceReportsPage() {
  const [period, setPeriod] = useState("year")

  const { data, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminFinanceReports(),
    queryFn: fetchFinanceReportData,
  })

  const reportData = data ?? {
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    paymentsByMonth: [],
    paymentsByCategory: [],
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount)
  }

  function formatMonth(monthStr: string) {
    const [year, month] = monthStr.split("-")
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString("en-NG", { month: "short", year: "numeric" })
  }

  return (
    <AdminTablePage
      title="Financial Reports"
      description="Analytics and insights for your finances"
      icon={BarChart3}
      backLinkHref="/admin/finance"
      backLinkLabel="Back to Finance"
      actions={
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      }
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(reportData.totalRevenue)}
            icon={TrendingUp}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
            description="From invoices"
          />
          <StatCard
            title="Total Expenses"
            value={formatCurrency(reportData.totalExpenses)}
            icon={TrendingDown}
            iconBgColor="bg-red-100 dark:bg-red-900/30"
            iconColor="text-red-600 dark:text-red-400"
            description="From payments & bills"
          />
          <StatCard
            title="Net Income"
            value={formatCurrency(reportData.netIncome)}
            icon={DollarSign}
            iconBgColor={
              reportData.netIncome >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
            }
            iconColor={
              reportData.netIncome >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }
            description="Revenue - Expenses"
          />
        </div>
      }
    >
      {loading ? (
        <PageLoader />
      ) : (
        <>
          {/* Charts/Tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Expenses by Month */}
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Month</CardTitle>
                <CardDescription>Monthly payment trends</CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.paymentsByMonth.length === 0 ? (
                  <EmptyState
                    title="No data available"
                    description="No monthly expense data was found for this period."
                  />
                ) : (
                  <div className="space-y-4">
                    {reportData.paymentsByMonth.map((item) => (
                      <div key={item.month} className="flex items-center justify-between">
                        <span className="text-sm">{formatMonth(item.month)}</span>
                        <div className="flex items-center gap-4">
                          <div className="bg-muted h-2 w-32 overflow-hidden rounded-full">
                            <div
                              className="bg-primary h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (item.amount / Math.max(...reportData.paymentsByMonth.map((m) => m.amount))) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="w-32 text-right text-sm font-medium">{formatCurrency(item.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expenses by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
                <CardDescription>Where your money goes</CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.paymentsByCategory.length === 0 ? (
                  <EmptyState
                    title="No data available"
                    description="No category expense data was found for this period."
                  />
                ) : (
                  <div className="space-y-4">
                    {reportData.paymentsByCategory.map((item) => (
                      <div key={item.category} className="flex items-center justify-between">
                        <span className="text-sm">{item.category}</span>
                        <div className="flex items-center gap-4">
                          <div className="bg-muted h-2 w-32 overflow-hidden rounded-full">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{
                                width: `${(item.amount / reportData.totalExpenses) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="w-32 text-right text-sm font-medium">{formatCurrency(item.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </AdminTablePage>
  )
}
