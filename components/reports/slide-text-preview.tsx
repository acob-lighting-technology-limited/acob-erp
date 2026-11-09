"use client"

import { Fragment, useMemo } from "react"
import { htmlToSlideTextBlocks, type SlideNumberStyle, type SlideTextBlock, type SlideTextRun } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

const ROMAN: Array<[number, string]> = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
]

function toRoman(value: number): string {
  let rest = value
  return ROMAN.reduce((out, [n, numeral]) => {
    while (rest >= n) {
      out += numeral
      rest -= n
    }
    return out
  }, "")
}

/** The marker PowerPoint draws for a numbered point, so the page matches the slide. */
function formatMarker(number: number, style: SlideNumberStyle = "arabicPeriod"): string {
  const suffix = style.endsWith("ParenR") ? ")" : "."
  if (style.startsWith("roman")) {
    const roman = toRoman(number)
    return (style.startsWith("romanUc") ? roman.toUpperCase() : roman) + suffix
  }
  if (style.startsWith("alpha")) {
    const letter = String.fromCharCode(96 + Math.min(Math.max(number, 1), 26))
    return (style.startsWith("alphaUc") ? letter.toUpperCase() : letter) + suffix
  }
  return `${number}${suffix}`
}

function Runs({ runs }: { runs: SlideTextRun[] }) {
  return runs.map((run, i) => (
    <span key={i} className={cn(run.bold && "font-semibold", run.italic && "italic")}>
      {run.text.split("\n").map((line, k) => (
        <Fragment key={k}>
          {k > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </span>
  ))
}

function Block({ block }: { block: SlideTextBlock }) {
  switch (block.kind) {
    case "heading":
      return (
        <h4 className="text-foreground mt-5 text-[15px] font-semibold first:mt-0">
          <Runs runs={block.runs} />
        </h4>
      )
    case "label":
      return (
        <p className="text-muted-foreground mt-4 text-[11px] font-semibold tracking-[0.14em] uppercase first:mt-0">
          <Runs runs={block.runs} />
        </p>
      )
    case "number":
    case "bullet":
      return (
        <div className="mt-2 grid grid-cols-[2rem_1fr] text-sm leading-6">
          <span className="text-muted-foreground tabular-nums">
            {block.kind === "bullet" ? "•" : formatMarker(block.number ?? 1, block.numberStyle)}
          </span>
          <span className="text-foreground/90">
            <Runs runs={block.runs} />
          </span>
        </div>
      )
    case "reply":
      return (
        <p className="text-muted-foreground mt-1 pl-8 text-[13px] leading-6 italic">
          <Runs runs={block.runs} />
        </p>
      )
    default:
      return (
        <p className="text-foreground/90 mt-2 text-sm leading-6 first:mt-0">
          <Runs runs={block.runs} />
        </p>
      )
  }
}

/**
 * A summary of minutes laid out the way the agenda deck shows it: section
 * headings, small labels, numbered points with their marker in a margin, and
 * replies indented under their point. Built from the same parse as the slides
 * (htmlToSlideTextBlocks), so what HR checks here is what the room will see.
 */
export function SlideTextPreview({ html, className }: { html: string; className?: string }) {
  // DOMParser is browser-only; summaries only render after the client has loaded them.
  const blocks = useMemo(() => (typeof window === "undefined" ? [] : htmlToSlideTextBlocks(html)), [html])
  return (
    <div className={cn("break-words", className)}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  )
}
