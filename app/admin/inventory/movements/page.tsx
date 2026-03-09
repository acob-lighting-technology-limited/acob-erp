"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, Boxes } from "lucide-react"
import { toast } from "sonner"

interface StockMovement {
  id: string
  product_id: string
  product_name?: string
  movement_type: "in" | "out" | "adjustment" | "transfer"
  quantity: number
  reference_number: string | null
  notes: string | null
  created_at: string
  created_by_name?: string
}

const typeColors: Record<string, string> = {
  in: "default",
  out: "destructive",
  adjustment: "secondary",
  transfer: "secondary",
}

const typeIcons: Record<string, any> = {
  in: ArrowDown,
  out: ArrowUp,
  adjustment: ArrowUpDown,
  transfer: ArrowUpDown,
}

export default function MovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>("all")

  useEffect(() => {
    fetchMovements()
  }, [])

  async function fetchMovements() {
    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, product:products(name), created_by:profiles(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) {
        if (error.code === "42P01") {
          setMovements([])
          return
        }
        throw error
      }

      const movementsWithNames = (data || []).map((m: any) => ({
        ...m,
        product_name: m.product?.name,
        created_by_name: m.created_by ? `${m.created_by.first_name} ${m.created_by.last_name}` : null,
      }))

      setMovements(movementsWithNames)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load movements")
    } finally {
      setLoading(false)
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const filteredMovements = movements.filter((m) => typeFilter === "all" || m.movement_type === typeFilter)

  const stats = {
    total: movements.length,
    in: movements.filter((m) => m.movement_type === "in").reduce((sum, m) => sum + m.quantity, 0),
    out: movements.filter((m) => m.movement_type === "out").reduce((sum, m) => sum + m.quantity, 0),
  }

  return (
    <AdminTablePage
      title="Stock Movements"
      description="Track stock in and out"
      icon={Boxes}
      backLinkHref="/admin/inventory"
      backLinkLabel="Back to Inventory"
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
          <StatCard title="Total Movements" value={stats.total} icon={ArrowUpDown} />
          <StatCard
            title="Stock In"
            value={`+${stats.in}`}
            icon={ArrowDown}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Stock Out"
            value={`-${stats.out}`}
            icon={ArrowUp}
            iconBgColor="bg-red-100 dark:bg-red-900/30"
            iconColor="text-red-600 dark:text-red-400"
          />
        </div>
      }
      filters={
        <div className="flex items-center gap-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="in">Stock In</SelectItem>
              <SelectItem value="out">Stock Out</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
          <CardDescription>{filteredMovements.length} movements</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
          ) : filteredMovements.length === 0 ? (
            <EmptyState title="No movements yet" description="Stock movements will appear here." icon={ArrowUpDown} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((m) => {
                    const Icon = typeIcons[m.movement_type]
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{formatDate(m.created_at)}</TableCell>
                        <TableCell className="font-medium">{m.product_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={typeColors[m.movement_type] as any} className="capitalize">
                            <Icon className="mr-1 h-3 w-3" />
                            {m.movement_type}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${m.movement_type === "in" ? "text-green-600" : m.movement_type === "out" ? "text-red-600" : ""}`}
                        >
                          {m.movement_type === "in" ? "+" : m.movement_type === "out" ? "-" : ""}
                          {m.quantity}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{m.reference_number || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.created_by_name || "—"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminTablePage>
  )
}
