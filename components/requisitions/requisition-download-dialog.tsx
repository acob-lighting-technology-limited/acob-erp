"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Download, File as FileIcon, FileImage, FileText, Files, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { attachmentHref, attachmentKind, type AttachmentKind } from "@/lib/requisitions/attachment-types"
import { downloadRequisitionPdf } from "@/lib/requisitions/document-pdf"
import type { Requisition } from "@/lib/requisitions/types"
import { INLINE_BENEFICIARIES } from "@/lib/requisitions/limits"

function sizeLabel(bytes: number | undefined) {
  if (!bytes) return null
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const KIND_ICON: Record<AttachmentKind, typeof FileText> = { pdf: FileText, image: FileImage, other: FileIcon }

/**
 * "Download" on a requisition: lists every document it has (the form itself and
 * each supporting file) so the person picks the one they want, instead of
 * everything being merged into one download. One row also offers the lot as a
 * single PDF.
 */
export function RequisitionDownloadDialog({
  open,
  onOpenChange,
  requisition,
  getSheet,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  requisition: Requisition
  /** The printed form on the page, which the form PDF is made from. */
  getSheet: () => HTMLElement | null
}) {
  const [busy, setBusy] = useState<string | null>(null)
  // Slashes are not allowed in file names: PR/HR/26/001 saves as PR-HR-26-001.pdf.
  const baseName = requisition.requisition_number.replace(/\//g, "-")
  const attachments = requisition.attachments || []
  const hasBulkBeneficiaries = requisition.beneficiary_details.length > INLINE_BENEFICIARIES
  const spreadsheetHref = `/api/requisitions/${requisition.id}/beneficiary-spreadsheet`

  const makePdf = async (key: string, withAttachments: boolean) => {
    const sheet = getSheet()
    if (!sheet) return toast.error("The form is not ready yet. Try again in a moment.")
    setBusy(key)
    try {
      await downloadRequisitionPdf(
        sheet,
        withAttachments ? `${baseName} with documents.pdf` : `${baseName}.pdf`,
        withAttachments
          ? attachments.map((file, i) => ({
              name: file.file_name,
              kind: attachmentKind(file.file_name, file.file_type),
              href: attachmentHref(requisition.id, i),
            }))
          : []
      )
      if (withAttachments && hasBulkBeneficiaries) {
        const link = document.createElement("a")
        link.href = spreadsheetHref
        link.download = `${baseName}-beneficiaries.xlsx`
        document.body.appendChild(link)
        link.click()
        link.remove()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the PDF")
    } finally {
      setBusy(null)
    }
  }

  const row = (key: string, icon: typeof FileText, title: string, detail: string | null, action: React.ReactNode) => {
    const Icon = icon
    return (
      <li key={key} className="flex min-w-0 items-center gap-3 rounded-md border p-3">
        <Icon className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          {detail ? <p className="text-muted-foreground truncate text-xs">{detail}</p> : null}
        </div>
        <div className="shrink-0">{action}</div>
      </li>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Download · {requisition.requisition_number}</DialogTitle>
          <DialogDescription>Pick the document you want.</DialogDescription>
        </DialogHeader>
        <ul className="min-w-0 space-y-2">
          {row(
            "form",
            FileText,
            "The form",
            `${baseName}.pdf · the filled-in form with its signatures`,
            <Button size="sm" variant="outline" onClick={() => void makePdf("form", false)} disabled={busy !== null}>
              {busy === "form" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download
            </Button>
          )}
          {attachments.map((file, i) =>
            row(
              `file-${i}`,
              KIND_ICON[attachmentKind(file.file_name, file.file_type)],
              file.file_name,
              [`Supporting document ${i + 1} of ${attachments.length}`, sizeLabel(file.file_size)]
                .filter(Boolean)
                .join(" · "),
              <Button asChild size="sm" variant="outline">
                <a href={attachmentHref(requisition.id, i, true)} download={file.file_name}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            )
          )}
          {hasBulkBeneficiaries
            ? row(
                "beneficiary-spreadsheet",
                FileIcon,
                "Beneficiary spreadsheet",
                `${requisition.beneficiary_details.length} beneficiaries · bank upload layout`,
                <Button asChild size="sm" variant="outline">
                  <a href={spreadsheetHref} download={`${baseName}-beneficiaries.xlsx`}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              )
            : null}
          {attachments.length || hasBulkBeneficiaries
            ? row(
                "all",
                Files,
                "Everything in one PDF",
                hasBulkBeneficiaries
                  ? "The form with every supporting document, plus the beneficiary spreadsheet"
                  : "The form with every supporting document after it",
                <Button size="sm" onClick={() => void makePdf("all", true)} disabled={busy !== null}>
                  {busy === "all" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download
                </Button>
              )
            : null}
        </ul>
        {attachments.length === 0 && !hasBulkBeneficiaries ? (
          <p className="text-muted-foreground text-xs">This requisition has no supporting documents.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
