"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Edit2, Trash2, Tag } from "lucide-react"
import { MarkdownContent } from "@/components/ui/markdown-content"
import type { Documentation } from "@/app/(app)/documentation/page"

interface DocCardViewProps {
  docs: Documentation[]
  formatDate: (dateString: string) => string
  onView: (doc: Documentation) => void
  onEdit: (doc: Documentation) => void
  onDelete: (doc: Documentation) => void
}

export function DocCardView({ docs, formatDate, onView, onEdit, onDelete }: DocCardViewProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {docs.map((doc) => (
        <Card key={doc.id} className="border-2 shadow-md transition-all hover:shadow-lg">
          <CardHeader className="from-primary/5 to-background border-b bg-gradient-to-r">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {doc.title}
                  {doc.is_draft && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30">
                      Draft
                    </Badge>
                  )}
                </CardTitle>
                {doc.category && <CardDescription className="mt-1">{doc.category}</CardDescription>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="max-h-48 overflow-auto rounded-md border p-3">
              <MarkdownContent content={doc.content} />
            </div>

            {doc.tags && doc.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {doc.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="text-muted-foreground text-xs">Last updated: {formatDate(doc.updated_at)}</div>

            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => onView(doc)} className="flex-1 gap-2">
                <Eye className="h-4 w-4" />
                View
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(doc)} className="flex-1 gap-2">
                <Edit2 className="h-4 w-4" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(doc)}
                className="gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
