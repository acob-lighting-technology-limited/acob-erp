import Image from "next/image"
import { Download, ExternalLink, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { attachmentHref, attachmentKind } from "@/lib/requisitions/attachment-types"
import type { Requisition } from "@/lib/requisitions/types"

/**
 * The supporting documents, shown under the form like pages stapled to it: a
 * receipt is an image on the page, a PDF is readable in place, and anything else
 * (a Word or Excel file) gets a card to open or save.
 */
export function RequisitionAttachments({ requisition }: { requisition: Requisition }) {
  const files = requisition.attachments || []
  if (!files.length) return null

  return (
    <section aria-label="Supporting documents" className="mx-auto w-full max-w-[210mm] space-y-4">
      <h2 className="text-sm font-semibold">Supporting documents ({files.length})</h2>
      {files.map((file, i) => {
        const kind = attachmentKind(file.file_name, file.file_type)
        const href = attachmentHref(requisition.id, i)
        return (
          <figure
            key={`${file.file_path}-${i}`}
            id={`attachment-${i}`}
            className="bg-card scroll-mt-24 overflow-hidden rounded-lg border"
          >
            <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                <span className="text-muted-foreground shrink-0">
                  Attachment {i + 1} of {files.length}
                </span>
                <span className="truncate font-medium">{file.file_name}</span>
              </span>
              <span className="flex gap-1.5">
                {kind === "other" ? null : (
                  <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                    <a href={href} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </a>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                  <a href={attachmentHref(requisition.id, i, true)}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </Button>
              </span>
            </figcaption>
            {kind === "image" ? (
              <Image
                src={href}
                alt={file.file_name}
                width={1200}
                height={900}
                unoptimized
                className="mx-auto h-auto max-h-[85vh] w-auto max-w-full bg-white object-contain"
              />
            ) : kind === "pdf" ? (
              <iframe title={file.file_name} src={href} loading="lazy" className="h-[85vh] w-full bg-white" />
            ) : (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                This kind of file cannot be shown on the page. Use Download to open it.
              </p>
            )}
          </figure>
        )
      })}
    </section>
  )
}
