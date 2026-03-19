"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { toast } from "sonner"
import { FormFieldGroup } from "@/components/ui/patterns"

interface Category {
  id: string
  name: string
}

async function fetchProductCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("product_categories").select("id, name").order("name")
  if (error && error.code !== "42P01") throw new Error(error.message)
  return data || []
}

export default function NewProductPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    category_id: "",
    unit_cost: 0,
    selling_price: 0,
    quantity_on_hand: 0,
    reorder_level: 10,
    status: "active",
  })

  const { data: categories = [] } = useQuery({
    queryKey: QUERY_KEYS.adminProductCategories(),
    queryFn: fetchProductCategories,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.sku || !formData.name) {
      toast.error("SKU and Name are required")
      return
    }

    setSaving(true)

    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error("You must be logged in")
        return
      }

      const { error } = await supabase.from("products").insert({
        sku: formData.sku,
        name: formData.name,
        description: formData.description || null,
        category_id: formData.category_id || null,
        unit_cost: formData.unit_cost,
        selling_price: formData.selling_price,
        quantity_on_hand: formData.quantity_on_hand,
        reorder_level: formData.reorder_level,
        status: formData.status,
        created_by: user.id,
      })

      if (error) throw error

      toast.success("Product created successfully!")
      router.push("/admin/inventory/products")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create product")
    } finally {
      setSaving(false)
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount)
  }

  const margin = formData.selling_price - formData.unit_cost
  const marginPercent = formData.unit_cost > 0 ? (margin / formData.unit_cost) * 100 : 0

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Add Product"
        description="Create a new product in your catalog"
        icon={Package}
        backLink={{ href: "/admin/inventory/products", label: "Back to Products" }}
      />
      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormFieldGroup label="SKU *">
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g., PROD-001"
                      required
                    />
                  </FormFieldGroup>
                  <FormFieldGroup label="Product Name *">
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Product name"
                      required
                    />
                  </FormFieldGroup>
                </div>
                <FormFieldGroup label="Description">
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Product description..."
                    rows={3}
                  />
                </FormFieldGroup>
                <FormFieldGroup label="Category">
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormFieldGroup>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormFieldGroup label="Unit Cost (NGN)">
                    <Input
                      id="unit_cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.unit_cost}
                      onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                    />
                  </FormFieldGroup>
                  <FormFieldGroup label="Selling Price (NGN)">
                    <Input
                      id="selling_price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.selling_price}
                      onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                    />
                  </FormFieldGroup>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Margin</span>
                    <span className={margin >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(margin)} ({marginPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormFieldGroup label="Quantity on Hand">
                    <Input
                      id="quantity_on_hand"
                      type="number"
                      min="0"
                      value={formData.quantity_on_hand}
                      onChange={(e) => setFormData({ ...formData, quantity_on_hand: parseInt(e.target.value) || 0 })}
                    />
                  </FormFieldGroup>
                  <FormFieldGroup label="Reorder Level" description="Alert when stock falls below this level">
                    <Input
                      id="reorder_level"
                      type="number"
                      min="0"
                      value={formData.reorder_level}
                      onChange={(e) => setFormData({ ...formData, reorder_level: parseInt(e.target.value) || 0 })}
                    />
                  </FormFieldGroup>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <StatCard
                  title="Stock Value"
                  value={formatCurrency(formData.unit_cost * formData.quantity_on_hand)}
                  icon={Package}
                />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SKU</span>
                  <span className="font-mono">{formData.sku || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost</span>
                  <span>{formatCurrency(formData.unit_cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span>{formatCurrency(formData.selling_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Initial Stock</span>
                  <span>{formData.quantity_on_hand}</span>
                </div>
                <div className="flex justify-between border-t pt-3 font-semibold">
                  <span>Stock Value</span>
                  <span>{formatCurrency(formData.unit_cost * formData.quantity_on_hand)}</span>
                </div>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={saving}>
              <Package className="mr-2 h-4 w-4" />
              Create Product
            </Button>
          </div>
        </div>
      </form>
    </PageWrapper>
  )
}
