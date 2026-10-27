"use client"

import type { ReactNode } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface DetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The record's name. Rendered as the sheet's accessible title. */
  title: ReactNode
  /** A badge beside the title, e.g. the leave type. */
  titleAside?: ReactNode
  /** One line under the title. Inline content only (text and spans): it renders inside a paragraph. */
  description?: ReactNode
  /** Avatar or icon at the left of the header. */
  leading?: ReactNode
  /** Status badges at the right of the header. They are kept clear of the close button. */
  badges?: ReactNode
  /** Sticky actions. Laid out with space between, so pass a left group and a right group. */
  footer?: ReactNode
  /** Two-column content such as a document preview wants more room than a record's details do. */
  wide?: boolean
  /** The body: sections that are divided by rules and scroll between the header and the footer. */
  children: ReactNode
}

/**
 * The shell for viewing one record in a side sheet: a fixed header, a scrolling body of divided sections,
 * and a sticky footer. Every record sheet uses this, so they share a width, header anatomy and spacing, and
 * the header never runs into the close button. Viewing a record opens a sheet; creating or editing opens a
 * modal (AGENTS.md, "Sheets and modals").
 */
export function DetailSheet({
  open,
  onOpenChange,
  title,
  titleAside,
  description,
  leading,
  badges,
  footer,
  wide = false,
  children,
}: DetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // Radix warns when a sheet has no description to point aria-describedby at. Opt out explicitly,
        // but only then: an undefined here would also cut the link to a description that exists.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn("flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl", wide && "md:max-w-2xl")}
      >
        {/* pr-12 keeps the badges clear of the absolutely positioned close button */}
        <SheetHeader className="bg-muted/20 space-y-0 border-b py-3.5 pr-12 pl-4 sm:pl-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {leading}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="truncate text-base font-semibold">{title}</SheetTitle>
                  {titleAside}
                </div>
                {description && (
                  <SheetDescription className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                    {description}
                  </SheetDescription>
                )}
              </div>
            </div>
            {badges && <div className="flex shrink-0 items-center gap-1.5">{badges}</div>}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="divide-y px-4 sm:px-5 [&>*]:py-4">{children}</div>
        </div>

        {footer && (
          <SheetFooter className="bg-muted/20 flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:px-5">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
