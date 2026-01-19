"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Package } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface Receipt {
  id: string
  receipt_number: string
  po_number?: string
  supplier_name?: string
  received_date: string
  total_items: number
  created_at: string
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReceipts()
  }, [])

  async function fetchReceipts() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("goods_receipts")
        .select("*, purchase_order:purchase_orders(po_number, supplier:suppliers(name))")
        .order("created_at", { ascending: false })

      if (error && error.code !== "42P01") throw error

      const receiptsData = (data || []).map((r: any) => ({
        ...r,
        po_number: r.purchase_order?.po_number,
        supplier_name: r.purchase_order?.supplier?.name,
      }))

      setReceipts(receiptsData)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load receipts")
    } finally {
      setLoading(false)
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/purchasing" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Goods Receipts</h1>
          </div>
          <p className="text-muted-foreground">Record of goods received from suppliers</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Receipts</CardTitle>
          <CardDescription>{receipts.length} receipts</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
          ) : receipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="font-semibold">No receipts yet</h3>
              <p className="text-muted-foreground text-sm">Receipts are created when orders are received.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>PO #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.receipt_number}</TableCell>
                    <TableCell className="font-mono">{r.po_number || "—"}</TableCell>
                    <TableCell>{r.supplier_name || "—"}</TableCell>
                    <TableCell>{formatDate(r.received_date)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{r.total_items}</Badge>
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
