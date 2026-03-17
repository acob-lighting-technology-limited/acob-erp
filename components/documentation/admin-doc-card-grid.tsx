"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, FileText, User, FolderOpen, Calendar, Tag } from "lucide-react"
import type { AdminDocumentation } from "./admin-doc-types"

interface AdminDocCardGridProps {
  docs: AdminDocumentation[]
  getStatusColor: (isDraft: boolean) => string
  formatDate: (dateString: string) => string
  onView: (doc: AdminDocumentation) => void
}

export function AdminDocCardGrid({ docs, getStatusColor, formatDate, onView }: AdminDocCardGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {docs.map((doc) => (
        <Card key={doc.id} className="border-2 transition-shadow hover:shadow-lg">
          <CardHeader className="from-primary/5 to-background border-b bg-gradient-to-r">
            <div className="flex items-start justify-between">
              <div className="flex flex-1 items-start gap-3">
                <div className="bg-primary/10 rounded-lg p-2">
                  <FileText className="text-primary h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="line-clamp-2 text-lg">{doc.title}</CardTitle>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={getStatusColor(doc.is_draft)}>{doc.is_draft ? "Draft" : "Published"}</Badge>
                    {doc.category && (
                      <Badge variant="outline" className="text-xs">
                        {doc.category}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              <span>
                {doc.user?.first_name} {doc.user?.last_name}
              </span>
            </div>

            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <FolderOpen className="h-4 w-4" />
              <span>{doc.user?.department || "No Department"}</span>
            </div>

            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(doc.created_at)}</span>
            </div>

            {doc.tags && doc.tags.length > 0 && (
              <div className="flex items-start gap-2">
                <Tag className="text-muted-foreground mt-1 h-4 w-4" />
                <div className="flex flex-wrap gap-1">
                  {doc.tags.slice(0, 3).map((tag, index) => (
                    <span key={index} className="bg-muted rounded px-2 py-1 text-xs">
                      {tag}
                    </span>
                  ))}
                  {doc.tags.length > 3 && (
                    <span className="text-muted-foreground px-2 py-1 text-xs">+{doc.tags.length - 3} more</span>
                  )}
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={() => onView(doc)} className="w-full gap-2">
              <Eye className="h-4 w-4" />
              View Document
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
