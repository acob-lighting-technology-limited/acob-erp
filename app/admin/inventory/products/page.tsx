"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Package, Search, Filter, Eye, Pencil } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  category_id: string | null
  category_name?: string
  unit_cost: number
  selling_price: number
  quantity_on_hand: number
  reorder_level: number
  status: "active" | "inactive" | "discontinued"
  created_at: string
}

const statusColors: Record<string, string> = {
  active: "default",
  inactive: "secondary",
  discontinued: "destructive",
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from("products")
        .select("*, category:product_categories(name)")
        .order("name")

      if (error) {
        if (error.code === "42P01") {
          console.log("Products table does not exist yet")
          setProducts([])
          return
        }
        throw error
      }

      const productsWithCategory = (data || []).map((p: any) => ({
        ...p,
        category_name: p.category?.name,
      }))

      setProducts(productsWithCategory)
    } catch (error) {
      console.error("Error fetching products:", error)
      toast.error("Failed to load products")
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

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || product.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const stats = {
    total: products.length,
    active: products.filter((p) => p.status === "active").length,
    lowStock: products.filter((p) => p.quantity_on_hand <= p.reorder_level).length,
    totalValue: products.reduce((sum, p) => sum + p.unit_cost * p.quantity_on_hand, 0),
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Products"
        description="Manage your product catalog"
        icon={Package}
        backLink={{ href: "/admin", label: "Back to Admin" }}
        actions={
          <Link href="/admin/inventory/products/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Products" value={stats.total} icon={Package} />
        <StatCard
          title="Active"
          value={stats.active}
          icon={Package}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStock}
          icon={Package}
          iconBgColor="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
        />
        <StatCard title="Stock Value" value={formatCurrency(stats.totalValue)} icon={Package} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
          <CardDescription>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Add your first product to start managing inventory."
              action={{ label: "Add Product", href: "/admin/inventory/products/new", icon: Plus }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">{product.category_name || "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.unit_cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.selling_price)}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          product.quantity_on_hand <= product.reorder_level ? "font-medium text-orange-600" : ""
                        }
                      >
                        {product.quantity_on_hand}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[product.status] as any} className="capitalize">
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/inventory/products/${product.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/inventory/products/${product.id}/edit`}>
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
