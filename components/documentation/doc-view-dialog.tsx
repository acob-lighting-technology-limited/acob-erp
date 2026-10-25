"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MarkdownContent } from "@/components/ui/markdown-content"
import { Download, Paperclip } from "lucide-react"
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl">
        <SheetHeader className="border-b p-5 pb-4">
          <SheetTitle className="text-xl font-bold">{doc?.title}</SheetTitle>
          <SheetDescription>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Badge className={getStatusColor(doc?.is_draft || false)}>{doc?.is_draft ? "Draft" : "Published"}</Badge>
              {doc?.category && <span className="text-sm">Category: {doc.category}</span>}
              <span className="text-sm">{doc?.updated_at && formatDate(doc.updated_at)}</span>
            </div>
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5">
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
          {doc?.sharepoint_attachments && doc.sharepoint_attachments.length > 0 && (
            <div className="mt-4 rounded-lg border p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Paperclip className="h-4 w-4" />
                Attachments
              </h4>
              <div className="space-y-2">
                {doc.sharepoint_attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{attachment.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {attachment.size
                          ? `${Math.max(1, Math.round(attachment.size / 1024))} KB`
                          : "Stored in SharePoint"}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="gap-2">
                      <a href={`/api/documentation/internal/${doc.id}/attachments/${attachment.id}/download`}>
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
