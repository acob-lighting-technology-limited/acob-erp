"use client"

import { Button } from "@/components/ui/button"
import { Download, Paperclip } from "lucide-react"
import { DocumentReaderSheet } from "./document-reader-sheet"
import type { Documentation } from "@/app/(app)/documentation/page"

interface DocViewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: Documentation | null
  getStatusColor: (isDraft: boolean) => string
  formatDate: (dateString: string) => string
}

export function DocViewSheet({ open, onOpenChange, doc, getStatusColor, formatDate }: DocViewSheetProps) {
  return (
    <DocumentReaderSheet
      open={open}
      onOpenChange={onOpenChange}
      title={doc?.title ?? "Documentation"}
      isDraft={doc?.is_draft || false}
      statusClassName={getStatusColor(doc?.is_draft || false)}
      description={
        <>
          {doc?.category && <span>Category: {doc.category}</span>}
          <span>{doc?.updated_at && formatDate(doc.updated_at)}</span>
        </>
      }
      tags={doc?.tags}
      content={doc?.content || ""}
      attachments={
        doc?.sharepoint_attachments && doc.sharepoint_attachments.length > 0 ? (
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
        ) : null
      }
    />
  )
}
