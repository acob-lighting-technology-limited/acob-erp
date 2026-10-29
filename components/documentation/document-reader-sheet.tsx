"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { MarkdownContent } from "@/components/ui/markdown-content"

type DocumentReaderSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  isDraft: boolean
  statusClassName: string
  tags?: string[] | null
  content: string
  attachments?: ReactNode
}

/** Shared read-only document shell for staff and admin document libraries. */
export function DocumentReaderSheet({
  open,
  onOpenChange,
  title,
  description,
  isDraft,
  statusClassName,
  tags,
  content,
  attachments,
}: DocumentReaderSheetProps) {
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={title}
      badges={<Badge className={statusClassName}>{isDraft ? "Draft" : "Published"}</Badge>}
      description={description}
    >
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      <div className="bg-muted/50 rounded-lg p-4">
        <MarkdownContent content={content} />
      </div>
      {attachments}
    </DetailSheet>
  )
}
