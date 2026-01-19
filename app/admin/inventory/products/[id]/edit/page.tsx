"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface Category {
  id: string
  name: string
}

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
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

  useEffect(() => {
    fetchData()
  }, [params.id])

  async function fetchData() {
    try {
      const supabase = createClient()
      const [{ data: product }, { data: cats }] = await Promise.all([
        supabase.from("products").select("*").eq("id", params.id).single(),
        supabase.from("product_categories").select("id, name").order("name"),
      ])

      if (product) {
        setFormData({
          sku: product.sku,
          name: product.name,
          description: product.description || "",
          category_id: product.category_id || "",
          unit_cost: product.unit_cost,
          selling_price: product.selling_price,
          quantity_on_hand: product.quantity_on_hand,
          reorder_level: product.reorder_level,
          status: product.status,
        })
      }
      setCategories(cats || [])
    } catch (error) {
      toast.error("Failed to load product")
      router.push("/admin/inventory/products")
    } finally {
      setLoading(false)
    }
  }

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
        .eq("id", params.id)

      if (error) throw error
      toast.success("Product updated")
      router.push(`/admin/inventory/products/${params.id}`)
    } catch (error: any) {
      toast.error(error.message || "Failed to update")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[400px] items-center justify-center p-6">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link
              href={`/admin/inventory/products/${params.id}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Edit Product</h1>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
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
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing & Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Unit Cost</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-two">
                <Label>Selling Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity on Hand</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.quantity_on_hand}
                  onChange={(e) => setFormData({ ...formData, quantity_on_hand: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Reorder Level</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.reorder_level}
                  onChange={(e) => setFormData({ ...formData, reorder_level: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
