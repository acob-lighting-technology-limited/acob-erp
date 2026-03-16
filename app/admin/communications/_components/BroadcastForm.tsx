"use client"

import { useRef, useEffect, useCallback } from "react"
import DOMPurify from "dompurify"
import { logger } from "@/lib/logger"
import { toast } from "sonner"
import { PromptDialog } from "@/components/ui/prompt-dialog"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bold, Italic, Underline, List, ListOrdered, Link2, Undo2, Redo2 } from "lucide-react"

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
  broadcastPreparedById: string
  setBroadcastPreparedById: (v: string) => void
  broadcastSubject: string
  setBroadcastSubject: (v: string) => void
  broadcastBodyHtml: string
  setBroadcastBodyHtml: (v: string) => void
  broadcastPreparedByOptions: Employee[]
}

export function BroadcastForm({
  broadcastDepartment,
  broadcastPreparedById,
  setBroadcastPreparedById,
  broadcastSubject,
  setBroadcastSubject,
  broadcastBodyHtml,
  setBroadcastBodyHtml,
  broadcastPreparedByOptions,
}: BroadcastFormProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)

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
      document.execCommand(command, false, value)
      setBroadcastBodyHtml(DOMPurify.sanitize(editorRef.current.innerHTML))
    },
    [setBroadcastBodyHtml]
  )

  const handleLinkConfirm = useCallback(
    (url: string) => {
      const trimmed = url.trim()
      // Only allow http/https URLs to prevent javascript: XSS via link injection
      if (!/^https?:\/\//i.test(trimmed)) {
        toast.error("Only https:// or http:// links are allowed.")
        return
      }
      runEditorCommand("createLink", trimmed)
    },
    [runEditorCommand]
  )

  // Suppress unused-variable warning for log
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
            <Input id="broadcast-department" value={broadcastDepartment || "—"} readOnly className="w-full" />
            <p className="text-muted-foreground text-xs">Locked to sender department.</p>
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
                onClick={() => setLinkDialogOpen(true)}
              >
                <Link2 className="h-4 w-4" />
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
              className="bg-background min-h-[220px] rounded-b-lg border p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-orange-500"
              onInput={(e) => setBroadcastBodyHtml(DOMPurify.sanitize((e.currentTarget as HTMLDivElement).innerHTML))}
            />
            <p className="text-muted-foreground text-xs">
              Paste text from Word or type directly. This message is placed between the ACOB header and footer.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
