"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Users, FileText, Package, ArrowLeft, AlertTriangle, Clock } from "lucide-react"
import Link from "next/link"

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
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Purchasing</h1>
          </div>
          <p className="text-muted-foreground">Manage suppliers and purchase orders</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSuppliers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <ShoppingCart className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Receipts</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingReceipts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Order Value</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalOrderValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Module Cards */}
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
    </div>
  )
}
