"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Package, Search, Filter, Eye, Pencil } from "lucide-react"
import Link from "next/link"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { TableSkeleton } from "@/components/ui/query-states"
import type { BadgeProps } from "@/components/ui/badge"
import { ProductFormDialog } from "./_components/product-form-dialog"
import { useSearchParams } from "next/navigation"

import { logger } from "@/lib/logger"

const log = logger("inventory-products")

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

interface ProductRow extends Product {
  category?: {
    name: string | null
  } | null
}

const statusColors: Record<Product["status"], BadgeProps["variant"]> = {
  active: "default",
  inactive: "secondary",
  discontinued: "destructive",
}

async function fetchProductsList(): Promise<Product[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("products").select("*, category:product_categories(name)").order("name")

  if (error) {
    if (error.code === "42P01") {
      log.debug("Products table does not exist yet")
      return []
    }
    throw new Error(error.message)
  }

  return ((data || []) as ProductRow[]).map((p) => ({
    ...p,
    category_name: p.category?.name || undefined,
  }))
}

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateOpen, setIsCreateOpen] = useState(searchParams.get("openCreate") === "1")
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const { data: products = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminProducts(),
    queryFn: fetchProductsList,
  })

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
    <AdminTablePage
      title="Products"
      description="Manage your product catalog"
      icon={Package}
      backLinkHref="/admin"
      backLinkLabel="Back to Admin"
      actions={
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
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
            <TableSkeleton rows={5} cols={6} />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Add your first product to start managing inventory."
              action={{ label: "Add Product", href: "/admin/inventory/products?openCreate=1", icon: Plus }}
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
                      <Badge variant={statusColors[product.status]} className="capitalize">
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
                        <Button variant="ghost" size="icon" onClick={() => setEditingProduct(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ProductFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} queryClient={queryClient} />
      <ProductFormDialog
        open={editingProduct !== null}
        onOpenChange={(open) => !open && setEditingProduct(null)}
        queryClient={queryClient}
        product={
          editingProduct
            ? {
                id: editingProduct.id,
                sku: editingProduct.sku,
                name: editingProduct.name,
                description: editingProduct.description || "",
                category_id: editingProduct.category_id || "",
                unit_cost: editingProduct.unit_cost,
                selling_price: editingProduct.selling_price,
                quantity_on_hand: editingProduct.quantity_on_hand,
                reorder_level: editingProduct.reorder_level,
                status: editingProduct.status,
              }
            : null
        }
      />
    </AdminTablePage>
  )
}
