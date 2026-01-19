"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil, Package } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

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
  status: string
  created_at: string
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProduct()
  }, [params.id])

  async function fetchProduct() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("products")
        .select("*, category:product_categories(name)")
        .eq("id", params.id)
        .single()

      if (error) throw error
      setProduct({
        ...data,
        category_name: data.category?.name,
      })
    } catch (error) {
      console.error("Error:", error)
      toast.error("Product not found")
      router.push("/admin/inventory/products")
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount)
  }

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[400px] items-center justify-center p-6">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    )
  }

  if (!product) return null

  const margin =
    product.selling_price > 0
      ? (((product.selling_price - product.unit_cost) / product.selling_price) * 100).toFixed(1)
      : "0"

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/inventory/products" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">{product.name}</h1>
          </div>
          <p className="text-muted-foreground font-mono">{product.sku}</p>
        </div>
        <Link href={`/admin/inventory/products/${product.id}/edit`}>
          <Button>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Product
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground text-sm">SKU</p>
                  <p className="font-mono font-medium">{product.sku}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Category</p>
                  <p className="font-medium">{product.category_name || "Uncategorized"}</p>
                </div>
              </div>
              {product.description && (
                <div>
                  <p className="text-muted-foreground text-sm">Description</p>
                  <p>{product.description}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-sm">Status</p>
                <Badge variant={product.status === "active" ? "default" : "secondary"} className="mt-1 capitalize">
                  {product.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground text-sm">Unit Cost</p>
                  <p className="text-xl font-semibold">{formatCurrency(product.unit_cost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Selling Price</p>
                  <p className="text-xl font-semibold">{formatCurrency(product.selling_price)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Margin</p>
                  <p className="text-xl font-semibold text-green-600">{margin}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Inventory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-muted-foreground text-sm">Quantity on Hand</p>
                <p className="text-3xl font-bold">{product.quantity_on_hand}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Reorder Level</p>
                <p className="text-lg font-medium">{product.reorder_level}</p>
              </div>
              {product.quantity_on_hand <= product.reorder_level && (
                <Badge variant="destructive" className="w-full justify-center py-2">
                  Low Stock Alert
                </Badge>
              )}
              <div>
                <p className="text-muted-foreground text-sm">Stock Value</p>
                <p className="text-lg font-semibold">{formatCurrency(product.quantity_on_hand * product.unit_cost)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
