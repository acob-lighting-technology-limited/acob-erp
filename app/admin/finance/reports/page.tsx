"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3 } from "lucide-react"

interface ReportData {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  paymentsByMonth: { month: string; amount: number }[]
  paymentsByCategory: { category: string; amount: number }[]
}

export default function FinanceReportsPage() {
  const [data, setData] = useState<ReportData>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    paymentsByMonth: [],
    paymentsByCategory: [],
  })
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("year")

  useEffect(() => {
    fetchReportData()
  }, [period])

  async function fetchReportData() {
    try {
      const supabase = createClient()

      // Get payments for reporting
      const { data: payments, error } = await supabase
        .from("department_payments")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error

      const allPayments = payments || []

      // Calculate totals
      const totalExpenses = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

      // Group by category
      const categoryMap = new Map<string, number>()
      allPayments.forEach((p) => {
        const cat = p.category || "Other"
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + (p.amount || 0))
      })
      const paymentsByCategory = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)

      // Group by month
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

      setData({
        totalRevenue: 0, // Would come from invoices
        totalExpenses,
        netIncome: -totalExpenses, // Simplified
        paymentsByMonth,
        paymentsByCategory,
      })
    } catch (error) {
      console.error("Error fetching report data:", error)
    } finally {
      setLoading(false)
    }
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
            value={formatCurrency(data.totalRevenue)}
            icon={TrendingUp}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
            description="From invoices"
          />
          <StatCard
            title="Total Expenses"
            value={formatCurrency(data.totalExpenses)}
            icon={TrendingDown}
            iconBgColor="bg-red-100 dark:bg-red-900/30"
            iconColor="text-red-600 dark:text-red-400"
            description="From payments & bills"
          />
          <StatCard
            title="Net Income"
            value={formatCurrency(data.netIncome)}
            icon={DollarSign}
            iconBgColor={data.netIncome >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}
            iconColor={data.netIncome >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
            description="Revenue - Expenses"
          />
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
        </div>
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
                {data.paymentsByMonth.length === 0 ? (
                  <EmptyState
                    title="No data available"
                    description="No monthly expense data was found for this period."
                  />
                ) : (
                  <div className="space-y-4">
                    {data.paymentsByMonth.map((item) => (
                      <div key={item.month} className="flex items-center justify-between">
                        <span className="text-sm">{formatMonth(item.month)}</span>
                        <div className="flex items-center gap-4">
                          <div className="bg-muted h-2 w-32 overflow-hidden rounded-full">
                            <div
                              className="bg-primary h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (item.amount / Math.max(...data.paymentsByMonth.map((m) => m.amount))) * 100)}%`,
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
                {data.paymentsByCategory.length === 0 ? (
                  <EmptyState
                    title="No data available"
                    description="No category expense data was found for this period."
                  />
                ) : (
                  <div className="space-y-4">
                    {data.paymentsByCategory.map((item) => (
                      <div key={item.category} className="flex items-center justify-between">
                        <span className="text-sm">{item.category}</span>
                        <div className="flex items-center gap-4">
                          <div className="bg-muted h-2 w-32 overflow-hidden rounded-full">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{
                                width: `${(item.amount / data.totalExpenses) * 100}%`,
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
