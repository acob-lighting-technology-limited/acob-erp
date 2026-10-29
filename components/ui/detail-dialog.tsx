"use client"

import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/**
 * Shared anatomy for "open this record and read it" sheets — the task detail,
 * the help desk ticket, anything of that species.
 *
 * These exist because every one of those sheets was independently built from
 * the same template and drifted: nested bordered cards, "hero stat cards"
 * restating values the header already showed, scattered icon-led fields in a
 * ragged grid, and a rule under every block. Values, not markup, are what a
 * page should be supplying.
 *
 * The rules the primitives encode:
 * - one reading column; air between sections instead of a rule under each
 * - the facts are one aligned list, not a grid of icons
 * - each fact appears exactly once (the header already shows status, weight)
 * - what needs answering (a blocker, a rejection note) comes before reference data
 * - what was said sits in a timeline, with the box to add to it above
 */

/** The scrolling body of a record sheet. Pass it as the children of a `flush` DetailSheet. */
export function DetailBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-7 px-4 py-5 sm:px-6">{children}</div>
    </div>
  )
}

/** A record's facts as one aligned list: label on the left, value on the right, a hairline between rows. */
export function DetailProperties({ children }: { children: React.ReactNode }) {
  return <dl className="divide-border/60 divide-y rounded-lg border">{children}</dl>
}

/** One row of `DetailProperties`. An empty value shows a dash so a row never collapses. */
export function DetailProperty({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children === null || children === undefined || children === false || children === ""
  return (
    <div className="grid grid-cols-[7rem_1fr] items-baseline gap-3 px-3.5 py-2.5 sm:grid-cols-[9rem_1fr]">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn("min-w-0 text-sm break-words", empty && "text-muted-foreground")}>{empty ? "—" : children}</dd>
    </div>
  )
}

export type DetailCalloutTone = "amber" | "rose" | "blue" | "emerald"

const CALLOUT_TONES: Record<DetailCalloutTone, string> = {
  amber: "border-warning/30 bg-warning/10 text-warning",
  rose: "border-danger/30 bg-danger/10 text-danger",
  blue: "border-info/30 bg-info/10 text-info",
  emerald: "border-success/30 bg-success/10 text-success",
}

/**
 * A blocker, a failure note, a rejection reason, a scope restriction — the thing
 * the reader most needs to see. Render these above the reference data, never
 * buried under it.
 */
export function DetailCallout({
  tone,
  label,
  children,
}: {
  tone: DetailCalloutTone
  label: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("rounded-lg border p-3", CALLOUT_TONES[tone])}>
      <p className="text-xs font-semibold">{label}</p>
      <div className="mt-0.5 text-sm whitespace-pre-wrap">{children}</div>
    </div>
  )
}

/** Section heading with an optional count. Sentence case, not shouted. */
export function DetailSectionHeading({ children, count }: { children: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="text-foreground text-sm font-semibold">{children}</h3>
      {count !== undefined && count > 0 && (
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums">{count}</span>
      )}
    </div>
  )
}

/**
 * The primary action bar, pinned between the header and the scroll area. The
 * one thing the sheet is opened to do belongs above the fold.
 */
export function DetailActionBar({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="bg-muted/20 border-b px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground shrink-0 text-xs">{label}</p>
        <div className="w-full max-w-[16rem]">{children}</div>
      </div>
      {hint && <p className="text-muted-foreground mt-1.5 text-xs">{hint}</p>}
    </div>
  )
}

/** The box that adds to a record's activity: one bordered surface holding the field and its button. */
export function DetailComposer({
  value,
  onChange,
  onSubmit,
  busy = false,
  placeholder = "Post an activity note or progress update…",
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void | Promise<void>
  busy?: boolean
  placeholder?: string
}) {
  return (
    <div className="focus-within:ring-ring/40 rounded-lg border focus-within:ring-2">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-[68px] resize-none border-0 text-sm shadow-none focus-visible:ring-0"
        aria-label="Add an activity"
      />
      <div className="flex justify-end border-t px-2 py-1.5">
        <Button size="sm" className="h-7 gap-1.5" disabled={busy || !value.trim()} onClick={() => void onSubmit()}>
          <Send className="h-3.5 w-3.5" />
          {busy ? "Posting…" : "Post"}
        </Button>
      </div>
    </div>
  )
}

/** The chronological list the entries sit in, joined by a vertical line. */
export function DetailTimeline({ children }: { children: React.ReactNode }) {
  return (
    <ul className="before:bg-border relative space-y-5 before:absolute before:top-1.5 before:bottom-1.5 before:left-[3px] before:w-px">
      {children}
    </ul>
  )
}

/** One entry in a chronological activity list. */
export function DetailTimelineEntry({
  title,
  timestamp,
  children,
}: {
  title: React.ReactNode
  timestamp: string
  children?: React.ReactNode
}) {
  return (
    <li className="relative pl-5">
      <span className="bg-muted-foreground/60 ring-background absolute top-1.5 left-0 h-[7px] w-[7px] rounded-full ring-4" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">{timestamp}</span>
      </div>
      {children && (
        <div className="text-foreground/80 mt-1 text-sm leading-relaxed whitespace-pre-wrap">{children}</div>
      )}
    </li>
  )
}
