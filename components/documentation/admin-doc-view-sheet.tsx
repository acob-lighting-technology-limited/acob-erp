"use client"

import { DocumentReaderSheet } from "./document-reader-sheet"
import type { AdminDocumentation } from "./admin-doc-types"

interface AdminDocViewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: AdminDocumentation | null
  getStatusColor: (isDraft: boolean) => string
  formatDate: (dateString: string) => string
}

export function AdminDocViewSheet({ open, onOpenChange, doc, getStatusColor, formatDate }: AdminDocViewSheetProps) {
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
          <span>
            By {doc?.user?.first_name} {doc?.user?.last_name}
          </span>
          <span>{doc?.created_at && formatDate(doc.created_at)}</span>
        </>
      }
      tags={doc?.tags}
      content={doc?.content || ""}
    />
  )
}
