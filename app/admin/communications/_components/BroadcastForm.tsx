"use client"

import type { ClipboardEvent } from "react"
import { useRef, useEffect, useCallback, useState } from "react"
import DOMPurify from "dompurify"
import { toast } from "sonner"
import { Bold, Italic, Link2, List, ListOrdered, Mail, Paperclip, Redo2, Underline, Undo2 } from "lucide-react"
import { logger } from "@/lib/logger"
import { PromptDialog } from "@/components/ui/prompt-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  broadcastSubject: string
  setBroadcastSubject: (value: string) => void
  broadcastBodyHtml: string
  setBroadcastBodyHtml: (value: string) => void
  broadcastPreparedByOptions: Employee[]
  departmentOptions: string[]
  attachments: File[]
  setAttachments: (files: File[]) => void
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function convertPlainTextToEditorHtml(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim()
  if (!normalized) return "<p><br></p>"

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return "<p><br></p>"

  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("")
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
  broadcastSubject,
  setBroadcastSubject,
  broadcastBodyHtml,
  setBroadcastBodyHtml,
  broadcastPreparedByOptions,
  departmentOptions,
  attachments,
  setAttachments,
}: BroadcastFormProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)

  const selectedPreparedBy =
    broadcastPreparedById === "none"
      ? null
      : broadcastPreparedByOptions.find((employee) => employee.id === broadcastPreparedById) || null

  const selectedPreparedByEmail = selectedPreparedBy?.company_email || selectedPreparedBy?.additional_email || null

  useEffect(() => {
    const el = editorRef.current
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

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const sanitized = DOMPurify.sanitize(broadcastBodyHtml)
    if (el.innerHTML !== sanitized) {
      el.innerHTML = sanitized
    }
  }, [broadcastBodyHtml])

  const runEditorCommand = useCallback(
    (command: string, value?: string) => {
      if (!editorRef.current) return
      editorRef.current.focus()

      const selection = window.getSelection()
      if (selection && savedRangeRef.current) {
        selection.removeAllRanges()
        selection.addRange(savedRangeRef.current)
      }

      document.execCommand(command, false, value)
      setBroadcastBodyHtml(DOMPurify.sanitize(editorRef.current.innerHTML))
    },
    [setBroadcastBodyHtml]
  )

  const saveCurrentSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return

    savedRangeRef.current = range.cloneRange()
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
      setBroadcastBodyHtml(DOMPurify.sanitize(editorRef.current?.innerHTML || ""))
    }
    toast.success(`Linked selected text to ${selectedPreparedByEmail}`)
  }, [broadcastSubject, runEditorCommand, selectedPreparedBy, selectedPreparedByEmail, setBroadcastBodyHtml])

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const pastedText = event.clipboardData.getData("text/plain")
      if (!pastedText) return

      event.preventDefault()
      runEditorCommand("insertHTML", convertPlainTextToEditorHtml(pastedText))
    },
    [runEditorCommand]
  )

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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
            <div className="bg-muted/50 flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 p-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => runEditorCommand("bold")}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => runEditorCommand("italic")}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => runEditorCommand("underline")}
              >
                <Underline className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => runEditorCommand("insertUnorderedList")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => runEditorCommand("insertOrderedList")}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  saveCurrentSelection()
                  setLinkDialogOpen(true)
                }}
                title="Insert web link"
              >
                <Link2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handlePreparedByMailLink}
                title="Link selected text to the Prepared by email"
              >
                <Mail className="h-4 w-4" />
              </Button>
              <div className="bg-border mx-1 h-5 w-px" />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => runEditorCommand("undo")}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => runEditorCommand("redo")}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="bg-background text-foreground min-h-[220px] rounded-b-lg border p-4 text-[15px] leading-7 break-words outline-none focus:ring-2 focus:ring-orange-500 [&_a]:font-medium [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-700 [&_br]:content-[''] [&_div]:my-0 [&_div+div]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-0 [&_p+*]:mt-4 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6"
              onInput={(e) => setBroadcastBodyHtml(DOMPurify.sanitize((e.currentTarget as HTMLDivElement).innerHTML))}
              onPaste={handlePaste}
              onKeyUp={saveCurrentSelection}
              onMouseUp={saveCurrentSelection}
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
