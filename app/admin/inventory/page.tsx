"use client"

import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, Boxes, Warehouse, ArrowUpDown, AlertTriangle, TrendingUp } from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { IconFill } from "@/components/ui/icon-fill"
import { formatCurrency } from "@/lib/format"

import { apiFetch } from "@/lib/api-client"
async function fetchInventoryStats(): Promise<InventoryStats> {
  const res = await apiFetch("/api/admin/inventory/stats", { cache: "no-store" })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load inventory stats")
  return res.json()
}

interface InventoryStats {
  totalProducts: number
  totalCategories: number
  totalWarehouses: number
  lowStockItems: number
  totalValue: number
}

export default function InventoryDashboard() {
  const {
    data: stats = { totalProducts: 0, totalCategories: 0, totalWarehouses: 0, lowStockItems: 0, totalValue: 0 },
  } = useQuery({
    queryKey: QUERY_KEYS.adminInventoryDashboard(),
    queryFn: fetchInventoryStats,
  })

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Inventory"
        description="Manage products, stock levels, and warehouses"
        icon={Package}
        backLink={{ href: "/admin/accounts", label: "Back to Accounts" }}
      />

      {/* Stats Grid */}
      <StatGrid>
        <StatCard
          variant="compact"
          title="Total Products"
          value={stats.totalProducts}
          icon={Package}
          description={`In ${stats.totalCategories} categories`}
        />
        <StatCard
          variant="compact"
          title="Low Stock"
          value={stats.lowStockItems}
          icon={AlertTriangle}
          iconBgColor="bg-warning/15"
          iconColor="text-warning"
          description="Items need reorder"
        />
        <StatCard
          variant="compact"
          title="Inventory Value"
          value={formatCurrency(stats.totalValue)}
          icon={TrendingUp}
          description="Total stock value"
        />
        <StatCard
          variant="compact"
          title="Warehouses"
          value={stats.totalWarehouses}
          icon={Warehouse}
          description="Storage locations"
        />
      </StatGrid>

      {/* Module Cards */}
      <Section title="Inventory Management">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {/* Products */}
          <Card className="group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <IconFill
                  icon={Package}
                  fillColor="bg-blue-500"
                  className="text-info border-info/20 bg-info/10 h-8 w-8 rounded-lg border transition-transform duration-200 group-hover:scale-105"
                  iconClassName="h-4 w-4"
                />
                <span className="transition-colors group-hover:text-blue-500">Products</span>
              </CardTitle>
              <CardDescription>Manage your product catalog</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/inventory/products">
                <Button className="w-full">View Products ({stats.totalProducts})</Button>
              </Link>
              <Link href="/admin/inventory/products?openCreate=1">
                <Button className="w-full" variant="outline">
                  Add Product
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card className="group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <IconFill
                  icon={Boxes}
                  fillColor="bg-purple-500"
                  className="border-purple/20 bg-purple/10 text-purple h-8 w-8 rounded-lg border transition-transform duration-200 group-hover:scale-105"
                  iconClassName="h-4 w-4"
                />
                <span className="transition-colors group-hover:text-purple-500">Categories</span>
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
          <Card className="group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <IconFill
                  icon={Warehouse}
                  fillColor="bg-teal-500"
                  className="text-success h-8 w-8 rounded-lg border border-teal-500/20 bg-teal-500/10 transition-transform duration-200 group-hover:scale-105"
                  iconClassName="h-4 w-4"
                />
                <span className="transition-colors group-hover:text-teal-500">Warehouses</span>
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
          <Card className="group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <IconFill
                  icon={ArrowUpDown}
                  fillColor="bg-emerald-500"
                  className="text-success border-success/20 bg-success/10 h-8 w-8 rounded-lg border transition-transform duration-200 group-hover:scale-105"
                  iconClassName="h-4 w-4"
                />
                <span className="transition-colors group-hover:text-emerald-500">Stock Movements</span>
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
      </Section>

      {/* Info Banner */}
      <Card className="border-warning/30 bg-warning/15">
        <CardContent className="flex items-start gap-4 p-6">
          <AlertTriangle className="mt-1 h-6 w-6 text-orange-600" />
          <div>
            <h3 className="text-warning font-semibold">Database Tables Required</h3>
            <p className="text-warning mt-1 text-sm">
              To use the Inventory module, you need to create the following database tables:
              <code className="bg-warning/15 mx-1 rounded px-1">products</code>,
              <code className="bg-warning/15 mx-1 rounded px-1">product_categories</code>,
              <code className="bg-warning/15 mx-1 rounded px-1">warehouses</code>, and
              <code className="bg-warning/15 mx-1 rounded px-1">stock_movements</code>.
            </p>
          </div>
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
