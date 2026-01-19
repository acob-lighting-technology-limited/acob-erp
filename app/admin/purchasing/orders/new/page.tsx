"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Trash2, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface Supplier {
  id: string
  name: string
  code: string
}
interface Product {
  id: string
  name: string
  sku: string
  unit_cost: number
}
interface POItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  amount: number
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [formData, setFormData] = useState({
    supplier_id: "",
    order_date: new Date().toISOString().split("T")[0],
    expected_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    currency: "NGN",
    notes: "",
  })
  const [items, setItems] = useState<POItem[]>([
    { id: crypto.randomUUID(), product_id: "", product_name: "", quantity: 1, unit_price: 0, amount: 0 },
  ])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data: sups } = await supabase.from("suppliers").select("id, name, code").eq("is_active", true).order("name")
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, sku, unit_cost")
      .eq("status", "active")
      .order("name")
    setSuppliers(sups || [])
    setProducts(prods || [])
  }

  function addItem() {
    setItems([
      ...items,
      { id: crypto.randomUUID(), product_id: "", product_name: "", quantity: 1, unit_price: 0, amount: 0 },
    ])
  }

  function removeItem(id: string) {
    if (items.length > 1) setItems(items.filter((i) => i.id !== id))
  }

  function updateItem(id: string, field: keyof POItem, value: string | number) {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          if (field === "product_id") {
            const prod = products.find((p) => p.id === value)
            if (prod) {
              updated.product_name = prod.name
              updated.unit_price = prod.unit_cost
            }
          }
          updated.amount = updated.quantity * updated.unit_price
          return updated
        }
        return item
      })
    )
  }

  function calculateTotal() {
    return items.reduce((sum, i) => sum + i.amount, 0)
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: formData.currency }).format(amount)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.supplier_id) {
      toast.error("Select a supplier")
      return
    }
    if (items.some((i) => !i.product_id)) {
      toast.error("Select products for all items")
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Not logged in")
        return
      }

      const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`
      const total = calculateTotal()

      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          po_number: poNumber,
          supplier_id: formData.supplier_id,
          order_date: formData.order_date,
          expected_date: formData.expected_date || null,
          total_amount: total,
          currency: formData.currency,
          status: "draft",
          notes: formData.notes || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (poError) throw poError

      const poItems = items.map((i) => ({
        purchase_order_id: po.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        amount: i.amount,
      }))

      const { error: itemsError } = await supabase.from("purchase_order_items").insert(poItems)
      if (itemsError) throw itemsError

      toast.success(`PO ${poNumber} created!`)
      router.push("/admin/purchasing/orders")
    } catch (error: any) {
      toast.error(error.message || "Failed to create")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/purchasing/orders" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Create Purchase Order</h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Supplier *</Label>
                    <Select
                      value={formData.supplier_id}
                      onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NGN">NGN</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Order Date</Label>
                    <Input
                      type="date"
                      value={formData.order_date}
                      onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected Delivery</Label>
                    <Input
                      type="date"
                      value={formData.expected_date}
                      onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="grid items-end gap-4 border-b pb-4 last:border-0 sm:grid-cols-12">
                    <div className="space-y-2 sm:col-span-5">
                      <Label>Product</Label>
                      <Select value={item.product_id} onValueChange={(v) => updateItem(item.id, "product_id", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Price</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2 text-right sm:col-span-2">
                      <Label>Amount</Label>
                      <p className="py-2 font-medium">{formatCurrency(item.amount)}</p>
                    </div>
                    <div className="sm:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={saving}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Create PO
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
