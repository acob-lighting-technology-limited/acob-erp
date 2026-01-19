"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Trash2, Receipt } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface BillItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

export default function NewBillPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    supplier_name: "",
    supplier_email: "",
    bill_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    currency: "NGN",
    notes: "",
  })
  const [items, setItems] = useState<BillItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, amount: 0 },
  ])

  function addItem() {
    setItems([...items, { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, amount: 0 }])
  }

  function removeItem(id: string) {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id))
    }
  }

  function updateItem(id: string, field: keyof BillItem, value: string | number) {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          updated.amount = updated.quantity * updated.unit_price
          return updated
        }
        return item
      })
    )
  }

  function calculateTotals() {
    const total = items.reduce((sum, item) => sum + item.amount, 0)
    return { total }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: formData.currency,
    }).format(amount)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.supplier_name) {
      toast.error("Supplier name is required")
      return
    }

    if (items.some((item) => !item.description)) {
      toast.error("All items must have a description")
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

      const { total } = calculateTotals()
      const billNumber = `BILL-${Date.now().toString(36).toUpperCase()}`

      const { data: bill, error: billError } = await supabase
        .from("bills")
        .insert({
          bill_number: billNumber,
          supplier_name: formData.supplier_name,
          supplier_email: formData.supplier_email || null,
          bill_date: formData.bill_date,
          due_date: formData.due_date,
          subtotal: total,
          tax_amount: 0,
          total_amount: total,
          amount_paid: 0,
          balance_due: total,
          currency: formData.currency,
          status: "pending",
          notes: formData.notes || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (billError) throw billError

      const billItems = items.map((item) => ({
        bill_id: bill.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: 0,
        amount: item.amount,
      }))

      const { error: itemsError } = await supabase.from("bill_items").insert(billItems)

      if (itemsError) throw itemsError

      toast.success(`Bill ${billNumber} created successfully!`)
      router.push("/admin/finance/bills")
    } catch (error: any) {
      console.error("Error creating bill:", error)
      toast.error(error.message || "Failed to create bill")
    } finally {
      setSaving(false)
    }
  }

  const totals = calculateTotals()

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/finance/bills" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Add Bill</h1>
          </div>
          <p className="text-muted-foreground">Record a new vendor bill</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Supplier Details */}
            <Card>
              <CardHeader>
                <CardTitle>Supplier Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="supplier_name">Supplier Name *</Label>
                    <Input
                      id="supplier_name"
                      value={formData.supplier_name}
                      onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                      placeholder="Supplier or vendor name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier_email">Email</Label>
                    <Input
                      id="supplier_email"
                      type="email"
                      value={formData.supplier_email}
                      onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })}
                      placeholder="supplier@example.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bill Items */}
            <Card>
              <CardHeader>
                <CardTitle>Bill Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="grid items-end gap-4 border-b pb-4 last:border-0 sm:grid-cols-12">
                    <div className="space-y-2 sm:col-span-5">
                      <Label>Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        placeholder="Item description"
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Unit Price</Label>
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

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bill Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bill_date">Bill Date</Label>
                  <Input
                    id="bill_date"
                    type="date"
                    value={formData.bill_date}
                    onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NGN">NGN - Nigerian Naira</SelectItem>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={saving}>
              <Receipt className="mr-2 h-4 w-4" />
              Save Bill
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
