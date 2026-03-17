"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye } from "lucide-react"
import { formatName } from "@/lib/utils"
import type { AdminDocumentation } from "./admin-doc-types"

interface AdminDocListViewProps {
  docs: AdminDocumentation[]
  getStatusColor: (isDraft: boolean) => string
  formatDate: (dateString: string) => string
  onView: (doc: AdminDocumentation) => void
}

export function AdminDocListView({ docs, getStatusColor, formatDate, onView }: AdminDocListViewProps) {
  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="table-responsive">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc, index) => (
                <TableRow key={doc.id}>
                  <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                  <TableCell>
                    {doc.user?.first_name && doc.user?.last_name
                      ? `${formatName(doc.user.last_name)}, ${formatName(doc.user.first_name)}`
                      : doc.user?.first_name || doc.user?.last_name
                        ? formatName(doc.user.first_name || doc.user.last_name)
                        : "-"}
                  </TableCell>
                  <TableCell>{doc.user?.department || "No Department"}</TableCell>
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
                  <TableCell className="text-muted-foreground text-sm">{formatDate(doc.created_at)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(doc)}
                      className="h-8 w-8 gap-1 p-0 sm:h-auto sm:w-auto sm:gap-2 sm:p-2"
                      title="View document"
                    >
                      <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">View</span>
                    </Button>
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
