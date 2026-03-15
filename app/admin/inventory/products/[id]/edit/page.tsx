"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { FormFieldGroup } from "@/components/ui/patterns"
import { PageLoader } from "@/components/ui/query-states"

interface Category {
  id: string
  name: string
}

interface ProductEditData {
  product: {
    sku: string
    name: string
    description: string
    category_id: string
    unit_cost: number
    selling_price: number
    quantity_on_hand: number
    reorder_level: number
    status: string
  }
  categories: Category[]
}

async function fetchProductEditData(id: string): Promise<ProductEditData> {
  const supabase = createClient()
  const [{ data: product, error: productError }, { data: cats }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("product_categories").select("id, name").order("name"),
  ])
  if (productError) throw new Error(productError.message)
  return {
    product: {
      sku: product.sku,
      name: product.name,
      description: product.description || "",
      category_id: product.category_id || "",
      unit_cost: product.unit_cost,
      selling_price: product.selling_price,
      quantity_on_hand: product.quantity_on_hand,
      reorder_level: product.reorder_level,
      status: product.status,
    },
    categories: cats || [],
  }
}

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    category_id: "",
    unit_cost: 0,
    selling_price: 0,
    quantity_on_hand: 0,
    reorder_level: 0,
    status: "active",
  })

  const { data: editData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.adminProductEditForm(id),
    queryFn: () => fetchProductEditData(id),
  })

  useEffect(() => {
    if (editData) setFormData(editData.product)
  }, [editData])

  const categories = editData?.categories ?? []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("products")
        .update({
          sku: formData.sku,
          name: formData.name,
          description: formData.description || null,
          category_id: formData.category_id || null,
          unit_cost: formData.unit_cost,
          selling_price: formData.selling_price,
          quantity_on_hand: formData.quantity_on_hand,
          reorder_level: formData.reorder_level,
          status: formData.status,
        })
        .eq("id", id)

      if (error) throw error
      toast.success("Product updated")
      router.push(`/admin/inventory/products/${id}`)
    } catch (error: any) {
      toast.error(error.message || "Failed to update")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="container mx-auto space-y-6 p-6">
      <PageHeader
        title="Edit Product"
        backLink={{ href: `/admin/inventory/products/${id}`, label: "Back to Product" }}
        actions={
          <Button onClick={handleSubmit} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="SKU *">
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  required
                />
              </FormFieldGroup>
              <FormFieldGroup label="Name *">
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </FormFieldGroup>
            </div>
            <FormFieldGroup label="Description">
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </FormFieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="Category">
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormFieldGroup>
              <FormFieldGroup label="Status">
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </FormFieldGroup>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing & Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormFieldGroup label="Unit Cost">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                />
              </FormFieldGroup>
              <FormFieldGroup label="Selling Price">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                />
              </FormFieldGroup>
              <FormFieldGroup label="Quantity on Hand">
                <Input
                  type="number"
                  min="0"
                  value={formData.quantity_on_hand}
                  onChange={(e) => setFormData({ ...formData, quantity_on_hand: parseInt(e.target.value) || 0 })}
                />
              </FormFieldGroup>
              <FormFieldGroup label="Reorder Level">
                <Input
                  type="number"
                  min="0"
                  value={formData.reorder_level}
                  onChange={(e) => setFormData({ ...formData, reorder_level: parseInt(e.target.value) || 0 })}
                />
              </FormFieldGroup>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
