"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckCircle2, Download, ExternalLink, FileText, History, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import {
  CONTROLLED_DOC_META,
  controlledDocFileHref,
  describeAudience,
  formatDocDate,
  formatFileSize,
  type ControlledDocDetailResponse,
} from "@/lib/documentation/controlled"
import { ControlledDocStatusBadge, ReviewDateBadge } from "./controlled-doc-badges"

interface ControlledDocViewDialogProps {
  documentId: string | null
  onOpenChange: (open: boolean) => void
  /** Called after an acknowledgement so the list can refresh. */
  onChanged?: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export function ControlledDocViewDialog({ documentId, onOpenChange, onChanged }: ControlledDocViewDialogProps) {
  const queryClient = useQueryClient()
  const open = documentId !== null
  const [openedVersionId, setOpenedVersionId] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [isAcknowledging, setIsAcknowledging] = useState(false)

  const { data, isLoading, error } = useQuery<ControlledDocDetailResponse>({
    queryKey: ["controlled-doc", documentId],
    queryFn: async () => {
      const res = await apiFetch(`/api/documentation/controlled/${documentId}`, { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load document")
      return payload
    },
    enabled: open,
  })

  const doc = data?.data
  const current = doc?.current_version ?? null
  const history = (data?.versions ?? []).filter((version) => version.id !== current?.id)
  const needsAcknowledgement =
    doc?.doc_type === "policy" && doc.status === "published" && Boolean(current) && !doc.my_acknowledged_at
  const hasOpenedCurrent = Boolean(current && openedVersionId === current.id)

  function close() {
    setOpenedVersionId(null)
    setConfirmed(false)
    onOpenChange(false)
  }

  async function acknowledge() {
    if (!doc || !current) return
    setIsAcknowledging(true)
    try {
      const res = await apiFetch(`/api/documentation/controlled/${doc.id}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: current.id }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(payload.error || "Failed to record acknowledgement")
      toast.success(`Thanks — you've acknowledged ${doc.reference_code} v${current.version_number}`)
      await queryClient.invalidateQueries({ queryKey: ["controlled-doc", doc.id] })
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record acknowledgement")
      await queryClient.invalidateQueries({ queryKey: ["controlled-doc", doc.id] })
    } finally {
      setIsAcknowledging(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        {isLoading || !doc ? (
          <>
            <DialogHeader>
              <DialogTitle>{error ? "Document unavailable" : "Loading document"}</DialogTitle>
              <DialogDescription>
                {error instanceof Error ? error.message : "Fetching the latest details..."}
              </DialogDescription>
            </DialogHeader>
            {!error && (
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {doc.reference_code}
                </Badge>
                {current && (
                  <Badge variant="outline" className="text-xs">
                    v{current.version_number}
                  </Badge>
                )}
                {doc.status !== "published" && <ControlledDocStatusBadge status={doc.status} />}
              </div>
              <DialogTitle className="pt-1 text-left">{doc.title}</DialogTitle>
              {doc.description && <DialogDescription className="text-left">{doc.description}</DialogDescription>}
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Category">{doc.category || "—"}</Field>
              <Field label="Owner">{doc.owner_department || "—"}</Field>
              <Field label="Applies to">{describeAudience(doc)}</Field>
              <Field label="Effective">{formatDocDate(current?.effective_date)}</Field>
              <Field label="Next review">
                <ReviewDateBadge date={doc.next_review_date} />
              </Field>
              <Field label="Published">{formatDocDate(doc.published_at)}</Field>
            </div>

            {current ? (
              <div className="bg-muted/40 space-y-3 rounded-lg border p-3">
                <div className="flex items-start gap-3">
                  <FileText className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{current.file_name}</p>
                    <p className="text-muted-foreground text-xs">
                      Version {current.version_number} · {formatFileSize(current.file_size)}
                      {current.change_summary ? ` · ${current.change_summary}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <a
                      href={controlledDocFileHref(current.id, "inline")}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpenedVersionId(current.id)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={controlledDocFileHref(current.id, "attachment")}
                      onClick={() => setOpenedVersionId(current.id)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No file has been uploaded yet.</p>
            )}

            {doc.doc_type === "policy" && doc.status === "published" && current && (
              <div className="space-y-3 rounded-lg border p-3">
                {doc.my_acknowledged_at ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    You acknowledged version {current.version_number} on {formatDocDate(doc.my_acknowledged_at)}.
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium">Acknowledgement required</p>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="cd-ack"
                        checked={confirmed}
                        disabled={!hasOpenedCurrent}
                        onCheckedChange={(value) => setConfirmed(value === true)}
                      />
                      <Label htmlFor="cd-ack" className="text-sm leading-snug font-normal">
                        I have read and understood {doc.reference_code} version {current.version_number}, and I agree to
                        comply with it.
                      </Label>
                    </div>
                    {!hasOpenedCurrent && (
                      <p className="text-muted-foreground text-xs">Open or download the policy first.</p>
                    )}
                  </>
                )}
              </div>
            )}

            {history.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <History className="h-4 w-4" />
                  Previous versions
                </p>
                <ul className="divide-y rounded-lg border">
                  {history.map((version) => (
                    <li key={version.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm">
                          v{version.version_number} · effective {formatDocDate(version.effective_date)}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {version.change_summary || version.file_name}
                          {version.uploaded_by_name ? ` · ${version.uploaded_by_name}` : ""}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="ghost" className="shrink-0">
                        <a
                          href={controlledDocFileHref(version.id, "attachment")}
                          aria-label={`Download v${version.version_number}`}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Close
              </Button>
              {needsAcknowledgement && (
                <Button onClick={() => void acknowledge()} disabled={!confirmed || isAcknowledging}>
                  {isAcknowledging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Acknowledge {CONTROLLED_DOC_META.policy.label}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
