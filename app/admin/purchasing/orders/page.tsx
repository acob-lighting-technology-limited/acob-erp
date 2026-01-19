"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, ShoppingCart, Search, Filter, Eye } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface PurchaseOrder {
  id: string
  po_number: string
  supplier_id: string
  supplier_name?: string
  order_date: string
  expected_date: string | null
  total_amount: number
  currency: string
  status: "draft" | "pending" | "approved" | "received" | "cancelled"
  created_at: string
}

const statusColors: Record<string, string> = {
  draft: "secondary",
  pending: "default",
  approved: "default",
  received: "default",
  cancelled: "destructive",
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, supplier:suppliers(name)")
        .order("created_at", { ascending: false })

      if (error && error.code !== "42P01") throw error

      const ordersWithSupplier = (data || []).map((o: any) => ({
        ...o,
        supplier_name: o.supplier?.name,
      }))

      setOrders(ordersWithSupplier)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load orders")
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(amount: number, currency: string = "NGN") {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount)
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })
  }

  const filtered = orders.filter((o) => {
    const matchesSearch =
      o.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const matchesStatus = statusFilter === "all" || o.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    approved: orders.filter((o) => o.status === "approved").length,
    totalValue: orders.reduce((sum, o) => sum + o.total_amount, 0),
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/purchasing" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Purchase Orders</h1>
          </div>
          <p className="text-muted-foreground">Manage purchase orders</p>
        </div>
        <Link href="/admin/purchasing/orders/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create PO
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <ShoppingCart className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <ShoppingCart className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <ShoppingCart className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by PO# or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>{filtered.length} orders</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="font-semibold">No purchase orders yet</h3>
              <Link href="/admin/purchasing/orders/new">
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create PO
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">{o.po_number}</TableCell>
                    <TableCell className="font-medium">{o.supplier_name || "—"}</TableCell>
                    <TableCell>{formatDate(o.order_date)}</TableCell>
                    <TableCell>{o.expected_date ? formatDate(o.expected_date) : "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(o.total_amount, o.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[o.status] as any} className="capitalize">
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/purchasing/orders/${o.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
