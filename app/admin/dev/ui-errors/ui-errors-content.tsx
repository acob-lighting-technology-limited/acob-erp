"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search } from "lucide-react"

export interface UiErrorRow {
  id: string
  created_at: string
  message: string
  source: string
  route: string
  user_name: string
}

interface UiErrorsContentProps {
  rows: UiErrorRow[]
}

export function UiErrorsContent({ rows }: UiErrorsContentProps) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.message.toLowerCase().includes(q) ||
        row.route.toLowerCase().includes(q) ||
        row.source.toLowerCase().includes(q) ||
        row.user_name.toLowerCase().includes(q)
    )
  }, [rows, query])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Captured UI Errors</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input placeholder="Search message, route, source, user..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    No UI errors found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {row.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate font-mono text-xs">{row.route || "-"}</TableCell>
                    <TableCell className="text-xs">{row.user_name || "Anonymous"}</TableCell>
                    <TableCell className="max-w-[520px] truncate text-xs">{row.message}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

