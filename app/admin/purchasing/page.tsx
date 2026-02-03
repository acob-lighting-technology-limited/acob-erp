"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Users, FileText, Package, AlertTriangle, Clock } from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"

interface PurchasingStats {
  totalSuppliers: number
  activeOrders: number
  pendingReceipts: number
  totalOrderValue: number
}

export default function PurchasingDashboard() {
  const [stats, setStats] = useState<PurchasingStats>({
    totalSuppliers: 0,
    activeOrders: 0,
    pendingReceipts: 0,
    totalOrderValue: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPurchasingData()
  }, [])

  async function fetchPurchasingData() {
    try {
      const supabase = createClient()

      const { data: suppliers } = await supabase.from("suppliers").select("*")
      const { data: orders } = await supabase.from("purchase_orders").select("*")

      const activeOrders = (orders || []).filter((o: any) => o.status === "pending" || o.status === "approved")
      const pendingReceipts = (orders || []).filter((o: any) => o.status === "approved").length
      const totalValue = (orders || []).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)

      setStats({
        totalSuppliers: suppliers?.length || 0,
        activeOrders: activeOrders.length,
        pendingReceipts,
        totalOrderValue: totalValue,
      })
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount)
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Purchasing"
        description="Manage suppliers and purchase orders"
        icon={ShoppingCart}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Suppliers" value={stats.totalSuppliers} icon={Users} description="Registered vendors" />
        <StatCard
          title="Active Orders"
          value={stats.activeOrders}
          icon={ShoppingCart}
          description="Pending & approved"
        />
        <StatCard
          title="Pending Receipts"
          value={stats.pendingReceipts}
          icon={Clock}
          iconBgColor="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
          description="Awaiting delivery"
        />
        <StatCard
          title="Order Value"
          value={formatCurrency(stats.totalOrderValue)}
          icon={FileText}
          description="Total order amount"
        />
      </div>

      {/* Module Cards */}
      <Section title="Purchasing Management">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Suppliers
              </CardTitle>
              <CardDescription>Manage your vendors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/purchasing/suppliers">
                <Button className="w-full">View Suppliers ({stats.totalSuppliers})</Button>
              </Link>
              <Link href="/admin/purchasing/suppliers/new">
                <Button className="w-full" variant="outline">
                  Add Supplier
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Purchase Orders
              </CardTitle>
              <CardDescription>Create and manage POs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/purchasing/orders">
                <Button className="w-full">View Orders</Button>
              </Link>
              <Link href="/admin/purchasing/orders/new">
                <Button className="w-full" variant="outline">
                  Create PO
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Receipts
              </CardTitle>
              <CardDescription>Record goods received</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/purchasing/receipts">
                <Button className="w-full" variant="outline">
                  View Receipts
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Info Banner */}
      <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
        <CardContent className="flex items-start gap-4 p-6">
          <AlertTriangle className="mt-1 h-6 w-6 text-orange-600" />
          <div>
            <h3 className="font-semibold text-orange-800 dark:text-orange-200">Database Tables Required</h3>
            <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
              Required tables:
              <code className="mx-1 rounded bg-orange-100 px-1 dark:bg-orange-900">suppliers</code>,
              <code className="mx-1 rounded bg-orange-100 px-1 dark:bg-orange-900">purchase_orders</code>,
              <code className="mx-1 rounded bg-orange-100 px-1 dark:bg-orange-900">purchase_order_items</code>.
            </p>
          </div>
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
