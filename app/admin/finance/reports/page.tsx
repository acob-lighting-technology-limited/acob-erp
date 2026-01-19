"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react"
import Link from "next/link"

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
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/finance" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Financial Reports</h1>
          </div>
          <p className="text-muted-foreground">Analytics and insights for your finances</p>
        </div>
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(data.totalRevenue)}</div>
                <p className="text-muted-foreground text-xs">From invoices</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(data.totalExpenses)}</div>
                <p className="text-muted-foreground text-xs">From payments & bills</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Income</CardTitle>
                <DollarSign className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(data.netIncome)}
                </div>
                <p className="text-muted-foreground text-xs">Revenue - Expenses</p>
              </CardContent>
            </Card>
          </div>

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
                  <p className="text-muted-foreground py-8 text-center">No data available</p>
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
                  <p className="text-muted-foreground py-8 text-center">No data available</p>
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
    </div>
  )
}
