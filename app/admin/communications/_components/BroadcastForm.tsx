"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import DOMPurify from "dompurify"
import { toast } from "sonner"
import { Link2, Mail, Paperclip } from "lucide-react"
import { logger } from "@/lib/logger"
import { PromptDialog } from "@/components/ui/prompt-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RichTextEditor, RichTextToolbarButton, type RichTextEditorHandle } from "@/components/ui/rich-text-editor"

const log = logger("broadcast-form")

type Employee = {
  id: string
  full_name: string
  company_email: string | null
  additional_email: string | null
  department: string | null
  employment_status: string | null
}

interface BroadcastFormProps {
  broadcastDepartment: string
  setBroadcastDepartment: (value: string) => void
  broadcastPreparedById: string
  setBroadcastPreparedById: (value: string) => void
  broadcastReplyToEmail: string
  setBroadcastReplyToEmail: (value: string) => void
  broadcastSubject: string
  setBroadcastSubject: (value: string) => void
  broadcastBodyHtml: string
  setBroadcastBodyHtml: (value: string) => void
  broadcastPreparedByOptions: Employee[]
  broadcastReplyToOptions: { email: string; label: string }[]
  departmentOptions: string[]
  attachments: File[]
  setAttachments: (files: File[]) => void
}

function buildPreparedByMailto(email: string, subject: string) {
  const trimmedSubject = subject.trim()
  const replySubject = trimmedSubject ? `Re: ${trimmedSubject}` : "Re:"
  return `mailto:${email}?subject=${encodeURIComponent(replySubject)}`
}

export function BroadcastForm({
  broadcastDepartment,
  setBroadcastDepartment,
  broadcastPreparedById,
  setBroadcastPreparedById,
  broadcastReplyToEmail,
  setBroadcastReplyToEmail,
  broadcastSubject,
  setBroadcastSubject,
  broadcastBodyHtml,
  setBroadcastBodyHtml,
  broadcastPreparedByOptions,
  broadcastReplyToOptions,
  departmentOptions,
  attachments,
  setAttachments,
}: BroadcastFormProps) {
  const editorRef = useRef<RichTextEditorHandle | null>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)

  const selectedPreparedBy =
    broadcastPreparedById === "none"
      ? null
      : broadcastPreparedByOptions.find((employee) => employee.id === broadcastPreparedById) || null

  const selectedPreparedByEmail = selectedPreparedBy?.company_email || selectedPreparedBy?.additional_email || null

  useEffect(() => {
    const el = editorRef.current?.element()
    if (!el || !selectedPreparedByEmail) return

    const nextHref = buildPreparedByMailto(selectedPreparedByEmail, broadcastSubject)
    let hasChanges = false

    el.querySelectorAll<HTMLAnchorElement>('a[data-link-type="prepared-by-mail"]').forEach((anchor) => {
      if (anchor.getAttribute("href") !== nextHref) {
        anchor.setAttribute("href", nextHref)
        hasChanges = true
      }
    })

    if (hasChanges) {
      setBroadcastBodyHtml(DOMPurify.sanitize(el.innerHTML))
    }
  }, [broadcastSubject, selectedPreparedByEmail, setBroadcastBodyHtml])

  const runEditorCommand = useCallback((command: string, value?: string) => {
    editorRef.current?.runCommand(command, value)
  }, [])

  const handleLinkConfirm = useCallback(
    (url: string) => {
      const trimmed = url.trim()
      if (!/^https?:\/\//i.test(trimmed)) {
        toast.error("Only https:// or http:// links are allowed.")
        return
      }
      runEditorCommand("createLink", trimmed)
      toast.success("Web link inserted")
    },
    [runEditorCommand]
  )

  const handlePreparedByMailLink = useCallback(() => {
    if (!selectedPreparedBy) {
      toast.error("Select a Prepared by person first.")
      return
    }

    if (!selectedPreparedByEmail) {
      toast.error("The selected Prepared by person does not have an email address.")
      return
    }

    const selection = window.getSelection()
    const selectedText = selection?.toString().trim() || ""
    if (!selectedText) {
      toast.error("Highlight the text you want to turn into an email link first.")
      return
    }

    const mailtoUrl = buildPreparedByMailto(selectedPreparedByEmail, broadcastSubject)

    runEditorCommand("createLink", mailtoUrl)
    const selectionAnchor = window.getSelection()?.anchorNode?.parentElement?.closest("a")
    if (selectionAnchor instanceof HTMLAnchorElement) {
      selectionAnchor.setAttribute("data-link-type", "prepared-by-mail")
      setBroadcastBodyHtml(DOMPurify.sanitize(editorRef.current?.element()?.innerHTML || ""))
    }
    toast.success(`Linked selected text to ${selectedPreparedByEmail}`)
  }, [broadcastSubject, runEditorCommand, selectedPreparedBy, selectedPreparedByEmail, setBroadcastBodyHtml])

  void log

  return (
    <>
      <PromptDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        title="Insert Link"
        description="Only https:// or http:// URLs are permitted."
        label="URL"
        placeholder="https://example.com"
        inputType="url"
        required
        confirmLabel="Insert"
        onConfirm={handleLinkConfirm}
      />
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="broadcast-department">Department</Label>
            <Select value={broadcastDepartment} onValueChange={setBroadcastDepartment}>
              <SelectTrigger id="broadcast-department" className="w-full">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Select the department branding and sign-off for this broadcast.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="broadcast-prepared-by">Prepared by</Label>
            <Select value={broadcastPreparedById} onValueChange={setBroadcastPreparedById}>
              <SelectTrigger id="broadcast-prepared-by" className="w-full">
                <SelectValue placeholder="Select person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select person</SelectItem>
                {broadcastPreparedByOptions.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">This will appear as &quot;Prepared by&quot; in the footer.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="broadcast-reply-to">Reply-to email</Label>
            <Select value={broadcastReplyToEmail} onValueChange={setBroadcastReplyToEmail}>
              <SelectTrigger id="broadcast-reply-to" className="w-full">
                <SelectValue placeholder="Select reply-to email" />
              </SelectTrigger>
              <SelectContent>
                {broadcastReplyToOptions.map((option) => (
                  <SelectItem key={option.email} value={option.email}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Defaults to the selected Prepared by person. Replies to this broadcast go to the email chosen here.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="broadcast-subject">Email Subject</Label>
            <Input
              id="broadcast-subject"
              value={broadcastSubject}
              onChange={(e) => setBroadcastSubject(e.target.value)}
              placeholder="Enter broadcast subject..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="broadcast-attachments">Attachments</Label>
            <Input
              id="broadcast-attachments"
              type="file"
              multiple
              onChange={(e) => setAttachments(Array.from(e.target.files || []))}
            />
            <p className="text-muted-foreground text-xs">
              Optional. Selected files will be attached to the broadcast email.
            </p>
            {attachments.length > 0 && (
              <div className="space-y-1 rounded-md border p-2 text-xs">
                {attachments.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 truncate">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Message Body (rich text)</Label>
            <RichTextEditor
              ref={editorRef}
              value={broadcastBodyHtml}
              onChange={setBroadcastBodyHtml}
              aria-label="Message body"
              toolbarExtra={
                <>
                  <RichTextToolbarButton
                    label="Insert web link"
                    onClick={() => {
                      editorRef.current?.saveSelection()
                      setLinkDialogOpen(true)
                    }}
                  >
                    <Link2 className="h-4 w-4" />
                  </RichTextToolbarButton>
                  <RichTextToolbarButton
                    label="Link selected text to the Prepared by email"
                    onClick={handlePreparedByMailLink}
                  >
                    <Mail className="h-4 w-4" />
                  </RichTextToolbarButton>
                </>
              }
            />
            <p className="text-muted-foreground text-xs">
              Paste text from Word or type directly. Use the chain icon for web links and the mail icon for reply links
              to the selected Prepared by person.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
