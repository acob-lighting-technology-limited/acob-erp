"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye, Edit2, Trash2 } from "lucide-react"
import type { Documentation } from "@/app/(app)/documentation/page"

interface DocListViewProps {
  docs: Documentation[]
  getStatusColor: (isDraft: boolean) => string
  formatDate: (dateString: string) => string
  onView: (doc: Documentation) => void
  onEdit: (doc: Documentation) => void
  onDelete: (doc: Documentation) => void
}

export function DocListView({ docs, getStatusColor, formatDate, onView, onEdit, onDelete }: DocListViewProps) {
  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="table-responsive">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc, index) => (
                <TableRow key={doc.id}>
                  <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell>
                    {doc.category ? (
                      <Badge variant="outline" className="text-xs">
                        {doc.category}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(doc.is_draft)}>{doc.is_draft ? "Draft" : "Published"}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(doc.updated_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(doc)}
                        className="h-8 w-8 p-0"
                        title="View document"
                        aria-label="View document"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(doc)}
                        className="h-8 w-8 p-0"
                        title="Edit document"
                        aria-label="Edit document"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(doc)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        title="Delete document"
                        aria-label="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
