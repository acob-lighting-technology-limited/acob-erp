"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Printer, CheckCircle, Package } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface PurchaseOrder {
  id: string
  po_number: string
  supplier_id: string
  supplier_name?: string
  order_date: string
  expected_date: string | null
  status: "draft" | "pending" | "approved" | "received" | "cancelled"
  total_amount: number
  currency: string
  notes: string | null
  items: POItem[]
}

interface POItem {
  id: string
  product_id: string
  product_name?: string
  quantity: number
  unit_price: number
  amount: number
}

export default function PurchaseOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrder()
  }, [params.id])

  async function fetchOrder() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, supplier:suppliers(name), items:purchase_order_items(*, product:products(name))")
        .eq("id", params.id)
        .single()

      if (error) throw error
      const orderWithNames = {
        ...data,
        supplier_name: data.supplier?.name,
        items: data.items?.map((i: any) => ({ ...i, product_name: i.product?.name })) || [],
      }
      setOrder(orderWithNames)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Order not found")
      router.push("/admin/purchasing/orders")
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(status: string) {
    try {
      const supabase = createClient()
      await supabase.from("purchase_orders").update({ status }).eq("id", params.id)
      toast.success(`Status updated to ${status}`)
      fetchOrder()
    } catch (error) {
      toast.error("Failed to update")
    }
  }

  function formatCurrency(amount: number, currency: string = "NGN") {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount)
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })
  }

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[400px] items-center justify-center p-6">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    )
  }

  if (!order) return null

  const statusColors: Record<string, string> = {
    draft: "secondary",
    pending: "default",
    approved: "default",
    received: "default",
    cancelled: "destructive",
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/purchasing/orders" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">{order.po_number}</h1>
            <Badge variant={statusColors[order.status] as any} className="ml-2 capitalize">
              {order.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">{order.supplier_name}</p>
        </div>
        <div className="flex items-center gap-2">
          {order.status === "draft" && <Button onClick={() => updateStatus("pending")}>Submit for Approval</Button>}
          {order.status === "pending" && (
            <Button onClick={() => updateStatus("approved")}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          )}
          {order.status === "approved" && (
            <Button onClick={() => updateStatus("received")}>
              <Package className="mr-2 h-4 w-4" />
              Mark as Received
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-sm">Order Date</p>
                <p className="font-medium">{formatDate(order.order_date)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Expected Delivery</p>
                <p className="font-medium">{order.expected_date ? formatDate(order.expected_date) : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Currency</p>
                <p className="font-medium">{order.currency}</p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product_name || "Unknown"}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_price, order.currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount, order.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end border-t pt-4">
              <div className="text-right">
                <p className="text-muted-foreground text-sm">Total Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(order.total_amount, order.currency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
