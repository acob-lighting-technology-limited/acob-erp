"use client"

import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Package } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"
import { TableSkeleton } from "@/components/ui/query-states"

interface Receipt {
  id: string
  receipt_number: string
  po_number?: string
  supplier_name?: string
  received_date: string
  total_items: number
  created_at: string
}

type ReceiptRow = Receipt & {
  purchase_order?: {
    po_number?: string | null
    supplier?: { name?: string | null } | null
  } | null
}

async function fetchReceipts(): Promise<Receipt[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("goods_receipts")
    .select("*, purchase_order:purchase_orders(po_number, supplier:suppliers(name))")
    .order("created_at", { ascending: false })

  if (error && error.code !== "42P01") throw new Error(error.message)

  return ((data || []) as ReceiptRow[]).map((r) => ({
    ...r,
    po_number: r.purchase_order?.po_number || undefined,
    supplier_name: r.purchase_order?.supplier?.name || undefined,
  }))
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })
}

export default function ReceiptsPage() {
  const { data: receipts = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.adminReceiptsList(),
    queryFn: fetchReceipts,
  })

  const stats = {
    total: receipts.length,
    items: receipts.reduce((acc, receipt) => acc + (receipt.total_items || 0), 0),
  }

  return (
    <AdminTablePage
      title="Goods Receipts"
      description="Record of goods received from suppliers"
      icon={Package}
      backLinkHref="/admin/purchasing"
      backLinkLabel="Back to Purchasing"
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
          <StatCard title="Receipts" value={stats.total} icon={Package} />
          <StatCard title="Total Items" value={stats.items} icon={Package} />
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>All Receipts</CardTitle>
          <CardDescription>{receipts.length} receipts</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : receipts.length === 0 ? (
            <EmptyState
              title="No receipts yet"
              description="Receipts are created when orders are received."
              icon={Package}
            />
          ) : (
            <div className="overflow-x-auto">
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
            </div>
          )}
        </CardContent>
      </Card>
    </AdminTablePage>
  )
}
