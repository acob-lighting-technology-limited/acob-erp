"use client"

import type { ClipboardEvent, ReactNode } from "react"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react"
import DOMPurify from "dompurify"
import { Bold, Heading, Italic, List, ListOrdered, Redo2, Underline, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cleanSlideTextHtml, convertMarkdownToHtml, plainTextToSlideHtml } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

export interface RichTextEditorHandle {
  /** Run a document.execCommand on the editor, restoring the last saved selection first. */
  runCommand: (command: string, value?: string) => void
  /** Remember the current selection, so a dialog can open without losing it. */
  saveSelection: () => void
  element: () => HTMLDivElement | null
}

interface RichTextEditorProps {
  /** HTML. Sanitised before it is written into the editor. */
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /**
   * "markdown" keeps only the pasted plain text and converts markdown (the
   * broadcast email behaviour). "slide-text" keeps pasted formatting, cleaned
   * down to what a PowerPoint text slide can show (see cleanSlideTextHtml).
   */
  pasteMode?: "markdown" | "slide-text"
  /** Underline button; off where the output cannot carry underline. */
  underline?: boolean
  /** Heading button (toggles the current block between a heading and a paragraph). */
  headings?: boolean
  /** Extra toolbar buttons, placed before undo/redo. */
  toolbarExtra?: ReactNode
  className?: string
  "aria-label"?: string
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}

/** Exported so callers adding their own toolbar buttons match the built-in ones. */
export { ToolbarButton as RichTextToolbarButton }

/**
 * contentEditable rich text editor with a formatting toolbar. Shared by the
 * broadcast composer and the minutes summary; output is sanitised HTML.
 */
export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  {
    value,
    onChange,
    placeholder = "Type your message here...",
    pasteMode = "markdown",
    underline = true,
    headings = false,
    toolbarExtra,
    className,
    "aria-label": ariaLabel,
  },
  ref
) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const isEmpty = !value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim()

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const sanitized = DOMPurify.sanitize(value)
    if (el.innerHTML !== sanitized) {
      el.innerHTML = sanitized
    }
  }, [value])

  const runCommand = useCallback(
    (command: string, commandValue?: string) => {
      if (!editorRef.current) return
      editorRef.current.focus()

      const selection = window.getSelection()
      if (selection && savedRangeRef.current) {
        selection.removeAllRanges()
        selection.addRange(savedRangeRef.current)
      }

      document.execCommand(command, false, commandValue)
      onChange(DOMPurify.sanitize(editorRef.current.innerHTML))
    },
    [onChange]
  )

  const saveSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return

    savedRangeRef.current = range.cloneRange()
  }, [])

  useImperativeHandle(ref, () => ({ runCommand, saveSelection, element: () => editorRef.current }), [
    runCommand,
    saveSelection,
  ])

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const pastedHtml = pasteMode === "slide-text" ? event.clipboardData.getData("text/html") : ""
      if (pastedHtml) {
        event.preventDefault()
        runCommand("insertHTML", cleanSlideTextHtml(pastedHtml))
        return
      }
      const pastedText = event.clipboardData.getData("text/plain")
      if (!pastedText) return

      event.preventDefault()
      runCommand(
        "insertHTML",
        pasteMode === "slide-text"
          ? cleanSlideTextHtml(plainTextToSlideHtml(pastedText))
          : convertMarkdownToHtml(pastedText)
      )
    },
    [pasteMode, runCommand]
  )

  const toggleHeading = () => {
    const block = document.queryCommandValue("formatBlock").toLowerCase()
    runCommand("formatBlock", block === "h3" ? "<p>" : "<h3>")
  }

  return (
    <div className={className}>
      <div className="bg-muted/50 flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 p-2">
        <ToolbarButton label="Bold" onClick={() => runCommand("bold")}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => runCommand("italic")}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        {underline && (
          <ToolbarButton label="Underline" onClick={() => runCommand("underline")}>
            <Underline className="h-4 w-4" />
          </ToolbarButton>
        )}
        {headings && (
          <ToolbarButton label="Heading" onClick={toggleHeading}>
            <Heading className="h-4 w-4" />
          </ToolbarButton>
        )}
        <ToolbarButton label="Bulleted list" onClick={() => runCommand("insertUnorderedList")}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => runCommand("insertOrderedList")}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        {toolbarExtra}

        <div className="bg-border mx-1 h-5 w-px" />

        <ToolbarButton label="Undo" onClick={() => runCommand("undo")}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => runCommand("redo")}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <div className="relative">
        {isEmpty && (
          <p className="text-muted-foreground pointer-events-none absolute top-4 left-4 text-[15px] leading-7">
            {placeholder}
          </p>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          className={cn(
            "bg-background text-foreground min-h-[220px] rounded-b-lg border p-4 text-[15px] leading-7 break-words outline-none focus:ring-2 focus:ring-orange-500 [&_a]:font-medium [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-700 [&_br]:content-[''] [&_div]:my-0 [&_div+div]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-0 [&_p+*]:mt-4 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6",
            headings &&
              "[&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:font-bold [&_h4]:font-bold"
          )}
          onInput={(e) => onChange(DOMPurify.sanitize((e.currentTarget as HTMLDivElement).innerHTML))}
          onPaste={handlePaste}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
        />
      </div>
    </div>
  )
})
