"use client"

import { Badge } from "@/components/ui/badge"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { MarkdownContent } from "@/components/ui/markdown-content"
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
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={doc?.title ?? "Documentation"}
      badges={<Badge className={getStatusColor(doc?.is_draft || false)}>{doc?.is_draft ? "Draft" : "Published"}</Badge>}
      description={
        <>
          {doc?.category && <span>Category: {doc.category}</span>}
          <span>
            By {doc?.user?.first_name} {doc?.user?.last_name}
          </span>
          <span>{doc?.created_at && formatDate(doc.created_at)}</span>
        </>
      }
    >
      {doc?.tags && doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {doc.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      <div className="bg-muted/50 rounded-lg p-4">
        <MarkdownContent content={doc?.content || ""} />
      </div>
    </DetailSheet>
  )
}
