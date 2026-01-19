"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, Boxes, Warehouse, ArrowUpDown, ArrowLeft, AlertTriangle, TrendingUp } from "lucide-react"
import Link from "next/link"

interface InventoryStats {
  totalProducts: number
  totalCategories: number
  totalWarehouses: number
  lowStockItems: number
  totalValue: number
}

export default function InventoryDashboard() {
  const [stats, setStats] = useState<InventoryStats>({
    totalProducts: 0,
    totalCategories: 0,
    totalWarehouses: 0,
    lowStockItems: 0,
    totalValue: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInventoryData()
  }, [])

  async function fetchInventoryData() {
    try {
      const supabase = createClient()

      // Try to fetch products (table may not exist yet)
      const { data: products, error: prodError } = await supabase.from("products").select("*")

      if (prodError && prodError.code !== "42P01") {
        console.error("Error fetching products:", prodError)
      }

      // Try to fetch categories
      const { data: categories, error: catError } = await supabase.from("product_categories").select("*")

      if (catError && catError.code !== "42P01") {
        console.error("Error fetching categories:", catError)
      }

      // Try to fetch warehouses
      const { data: warehouses, error: whError } = await supabase.from("warehouses").select("*")

      if (whError && whError.code !== "42P01") {
        console.error("Error fetching warehouses:", whError)
      }

      const allProducts = products || []
      const lowStock = allProducts.filter((p: any) => p.quantity_on_hand <= (p.reorder_level || 10))
      const totalVal = allProducts.reduce(
        (sum: number, p: any) => sum + (p.unit_cost || 0) * (p.quantity_on_hand || 0),
        0
      )

      setStats({
        totalProducts: allProducts.length,
        totalCategories: categories?.length || 0,
        totalWarehouses: warehouses?.length || 0,
        lowStockItems: lowStock.length,
        totalValue: totalVal,
      })
    } catch (error) {
      console.error("Error fetching inventory data:", error)
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

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Inventory</h1>
          </div>
          <p className="text-muted-foreground">Manage products, stock levels, and warehouses</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-muted-foreground text-xs">In {stats.totalCategories} categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            <p className="text-muted-foreground text-xs">Total stock value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warehouses</CardTitle>
            <Warehouse className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWarehouses}</div>
            <p className="text-muted-foreground text-xs">Storage locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.lowStockItems}</div>
            <p className="text-muted-foreground text-xs">Items need reorder</p>
          </CardContent>
        </Card>
      </div>

      {/* Module Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Products
            </CardTitle>
            <CardDescription>Manage your product catalog</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/inventory/products">
              <Button className="w-full">View Products ({stats.totalProducts})</Button>
            </Link>
            <Link href="/admin/inventory/products/new">
              <Button className="w-full" variant="outline">
                Add Product
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              Categories
            </CardTitle>
            <CardDescription>Organize products by category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/inventory/categories">
              <Button className="w-full">View Categories ({stats.totalCategories})</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Warehouses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Warehouses
            </CardTitle>
            <CardDescription>Manage storage locations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/inventory/warehouses">
              <Button className="w-full">View Warehouses ({stats.totalWarehouses})</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Stock Movements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              Stock Movements
            </CardTitle>
            <CardDescription>Track stock in and out</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/inventory/movements">
              <Button className="w-full" variant="outline">
                View Movements
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
              To use the Inventory module, you need to create the following database tables:
              <code className="mx-1 rounded bg-orange-100 px-1 dark:bg-orange-900">products</code>,
              <code className="mx-1 rounded bg-orange-100 px-1 dark:bg-orange-900">product_categories</code>,
              <code className="mx-1 rounded bg-orange-100 px-1 dark:bg-orange-900">warehouses</code>, and
              <code className="mx-1 rounded bg-orange-100 px-1 dark:bg-orange-900">stock_movements</code>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
