"use client"

import { PromptDialog } from "@/components/ui/prompt-dialog"

function prettyDocName(name: string) {
  return name.replaceAll("_", " ")
}

interface LeaveRejectPromptDialogProps {
  rejectPrompt: { requestId: string } | null
  onOpenChange: (open: boolean) => void
  onConfirm: (requestId: string, reason: string) => void
}

export function LeaveRejectPromptDialog({ rejectPrompt, onOpenChange, onConfirm }: LeaveRejectPromptDialogProps) {
  return (
    <PromptDialog
      open={!!rejectPrompt}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false)
      }}
      title="Rejection Reason"
      description="Please provide a reason for rejecting this leave request."
      label="Reason"
      placeholder="Enter rejection reason..."
      inputType="textarea"
      required
      confirmLabel="Reject Leave"
      confirmVariant="destructive"
      onConfirm={(reason) => {
        if (rejectPrompt) onConfirm(rejectPrompt.requestId, reason)
      }}
    />
  )
}

interface LeaveEvidencePromptDialogProps {
  evidencePrompt: { requestId: string; documentType: string } | null
  onOpenChange: (open: boolean) => void
  onConfirm: (requestId: string, documentType: string, url: string) => void
}

export function LeaveEvidencePromptDialog({ evidencePrompt, onOpenChange, onConfirm }: LeaveEvidencePromptDialogProps) {
  return (
    <PromptDialog
      open={!!evidencePrompt}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false)
      }}
      title={`Upload Evidence: ${evidencePrompt ? prettyDocName(evidencePrompt.documentType) : ""}`}
      description="Enter the URL of the uploaded document."
      label="Document URL"
      placeholder="https://..."
      inputType="url"
      required
      confirmLabel="Submit"
      onConfirm={(url) => {
        if (evidencePrompt) onConfirm(evidencePrompt.requestId, evidencePrompt.documentType, url)
      }}
    />
  )
}
