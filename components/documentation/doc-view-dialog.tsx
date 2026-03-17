"use client"

import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MarkdownContent } from "@/components/ui/markdown-content"
import type { Documentation } from "@/app/(app)/documentation/page"

interface DocViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: Documentation | null
  getStatusColor: (isDraft: boolean) => string
  formatDate: (dateString: string) => string
}

export function DocViewDialog({ open, onOpenChange, doc, getStatusColor, formatDate }: DocViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{doc?.title}</DialogTitle>
          <DialogDescription>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Badge className={getStatusColor(doc?.is_draft || false)}>{doc?.is_draft ? "Draft" : "Published"}</Badge>
              {doc?.category && <span className="text-sm">Category: {doc.category}</span>}
              <span className="text-sm">{doc?.updated_at && formatDate(doc.updated_at)}</span>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {doc?.tags && doc.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {doc.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="bg-muted/50 rounded-lg p-4">
            <MarkdownContent content={doc?.content || ""} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
