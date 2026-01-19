"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Pencil, Phone, Mail, MapPin, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface Supplier {
  id: string
  name: string
  code: string
  email: string | null
  phone: string | null
  address: string | null
  contact_person: string | null
  is_active: boolean
  created_at: string
}

interface PurchaseOrder {
  id: string
  po_number: string
  order_date: string
  total_amount: number
  status: string
}

export default function SupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [params.id])

  async function fetchData() {
    try {
      const supabase = createClient()
      const [{ data: sup }, { data: pos }] = await Promise.all([
        supabase.from("suppliers").select("*").eq("id", params.id).single(),
        supabase
          .from("purchase_orders")
          .select("id, po_number, order_date, total_amount, status")
          .eq("supplier_id", params.id)
          .order("order_date", { ascending: false })
          .limit(10),
      ])

      if (!sup) throw new Error("Not found")
      setSupplier(sup)
      setOrders(pos || [])
    } catch (error) {
      console.error("Error:", error)
      toast.error("Supplier not found")
      router.push("/admin/purchasing/suppliers")
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount)
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })
  }

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[400px] items-center justify-center p-6">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    )
  }

  if (!supplier) return null

  const totalSpent = orders.reduce((sum, o) => sum + o.total_amount, 0)

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/purchasing/suppliers" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">{supplier.name}</h1>
            <Badge variant={supplier.is_active ? "default" : "secondary"} className="ml-2">
              {supplier.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono">{supplier.code}</p>
        </div>
        <Link href={`/admin/purchasing/suppliers/${supplier.id}/edit`}>
          <Button>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Supplier
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {supplier.contact_person && (
                  <div>
                    <p className="text-muted-foreground text-sm">Contact Person</p>
                    <p className="font-medium">{supplier.contact_person}</p>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="text-muted-foreground h-4 w-4" />
                    <a href={`mailto:${supplier.email}`} className="hover:underline">
                      {supplier.email}
                    </a>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="text-muted-foreground h-4 w-4" />
                    <a href={`tel:${supplier.phone}`} className="hover:underline">
                      {supplier.phone}
                    </a>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="text-muted-foreground mt-1 h-4 w-4" />
                    <p>{supplier.address}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Last 10 purchase orders</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <ShoppingCart className="text-muted-foreground mb-2 h-8 w-8" />
                  <p className="text-muted-foreground">No orders yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link href={`/admin/purchasing/orders/${order.id}`} className="font-mono hover:underline">
                            {order.po_number}
                          </Link>
                        </TableCell>
                        <TableCell>{formatDate(order.order_date)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(order.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-muted-foreground text-sm">Total Orders</p>
                <p className="text-2xl font-bold">{orders.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Spent</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Joined</p>
                <p className="font-medium">{formatDate(supplier.created_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
