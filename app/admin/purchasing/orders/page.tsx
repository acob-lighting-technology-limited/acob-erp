"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, ShoppingCart, Search, Filter, Eye } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { PageWrapper, PageHeader } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

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
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Purchase Orders"
        description="Manage purchase orders"
        icon={ShoppingCart}
        backLink={{ href: "/admin/purchasing", label: "Back to Purchasing" }}
        actions={
          <Link href="/admin/purchasing/orders/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create PO
            </Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Orders" value={stats.total} icon={ShoppingCart} />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon={ShoppingCart}
          iconBgColor="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon={ShoppingCart}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
        />
        <StatCard title="Total Value" value={formatCurrency(stats.totalValue)} icon={ShoppingCart} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>{filtered.length} orders</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No purchase orders yet"
              description="Create your first purchase order."
              action={{ label: "Create PO", href: "/admin/purchasing/orders/new", icon: Plus }}
            />
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
    </PageWrapper>
  )
}
