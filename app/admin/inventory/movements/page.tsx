"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react"
import Link from "next/link"
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
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/inventory" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Stock Movements</h1>
          </div>
          <p className="text-muted-foreground">Track stock in and out</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Movements</CardTitle>
            <ArrowUpDown className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock In</CardTitle>
            <ArrowDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{stats.in}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Out</CardTitle>
            <ArrowUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-{stats.out}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowUpDown className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="font-semibold">No movements yet</h3>
              <p className="text-muted-foreground text-sm">Stock movements will appear here.</p>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
