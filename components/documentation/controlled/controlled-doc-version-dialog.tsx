"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api-client"
import { toLocalISODate } from "@/lib/utils/date"
import {
  CONTROLLED_DOC_ACCEPT,
  CONTROLLED_DOC_MAX_FILE_BYTES,
  isAllowedControlledDocFile,
  type ControlledDocRow,
} from "@/lib/documentation/controlled"

interface ControlledDocVersionDialogProps {
  doc: ControlledDocRow | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function ControlledDocVersionDialog({ doc, onOpenChange, onSaved }: ControlledDocVersionDialogProps) {
  const open = doc !== null
  const nextVersion = (doc?.current_version?.version_number ?? 0) + 1
  const [file, setFile] = useState<File | null>(null)
  const [effectiveDate, setEffectiveDate] = useState(toLocalISODate(new Date()))
  const [changeSummary, setChangeSummary] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  function close() {
    setFile(null)
    setEffectiveDate(toLocalISODate(new Date()))
    setChangeSummary("")
    onOpenChange(false)
  }

  async function handleSubmit() {
    if (!doc) return
    if (!file) return void toast.error("Attach the new file")
    if (!isAllowedControlledDocFile(file.name)) return void toast.error("Upload a PDF, Word, Excel, or PowerPoint file")
    if (file.size > CONTROLLED_DOC_MAX_FILE_BYTES) {
      return void toast.error("File is larger than 4 MB — compress it and try again")
    }
    if (!effectiveDate) return void toast.error("Effective date is required")
    if (!changeSummary.trim()) return void toast.error("Describe what changed")

    setIsSaving(true)
    try {
      const body = new FormData()
      body.set("file", file)
      body.set("effective_date", effectiveDate)
      body.set("change_summary", changeSummary.trim())
      const res = await apiFetch(`/api/documentation/controlled/${doc.id}/versions`, { method: "POST", body })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(payload.error || "Failed to upload the new version")
      toast.success(`${doc.reference_code} v${nextVersion} uploaded`)
      onSaved()
      close()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload the new version")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSaving && close()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Version {nextVersion}</DialogTitle>
          <DialogDescription>
            {doc?.reference_code} · {doc?.title}
          </DialogDescription>
        </DialogHeader>

        {doc?.status === "published" && (
          <Alert>
            <AlertDescription className="text-xs">
              {doc.doc_type === "policy"
                ? "This version takes over straight away. All staff are notified and must acknowledge it again."
                : "This version takes over straight away and the SOP's audience is notified."}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cdv-file">New file *</Label>
            <Input
              id="cdv-file"
              type="file"
              accept={CONTROLLED_DOC_ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-muted-foreground text-xs">PDF, Word, Excel or PowerPoint · max 4 MB</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdv-effective">Effective date *</Label>
            <Input
              id="cdv-effective"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdv-summary">What changed *</Label>
            <Textarea
              id="cdv-summary"
              rows={3}
              maxLength={1000}
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="e.g. Annual leave entitlement raised from 15 to 21 days"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
