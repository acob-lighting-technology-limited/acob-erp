"use client"

import { useLayoutEffect, useState, type RefObject } from "react"

/** Classic 3:4.4 pill; big groups may go slimmer, but never past MAX_RATIO. */
const PILL_RATIO = 4.4 / 3
const MAX_RATIO = 1.8
const MAX_ROWS = 4
const ROW_GAP = 20
/** Gold ring + its offset, both sides. */
const RING = 16
/** Member gap + name→pill gap + date pill, excluding the name line itself. */
const CAPTION_BASE = 40

export interface LineupLayout {
  rows: number
  /** Horizontal gap between portraits. */
  gap: number
  /** Width each member column gets — fixed so every row holds the same count. */
  memberWidth: number
  portraitWidth: number
  portraitHeight: number
  nameSize: number
}

/**
 * Try 1…MAX_ROWS rows and keep whichever gives the biggest portraits. One row
 * wins for small groups; big groups (where a single row would leave each person
 * a sliver) wrap into evenly-filled rows instead of leaving the screen half empty.
 */
export function planLineup(count: number, width: number, height: number, stagger: number): LineupLayout | null {
  let best: LineupLayout | null = null
  for (let rows = 1; rows <= Math.min(MAX_ROWS, count); rows++) {
    const perRow = Math.ceil(count / rows)
    const gap = Math.min(56, Math.max(12, (width * 0.16) / perRow))
    const slot = (width - (perRow - 1) * gap) / perRow - RING
    const nameSize = Math.min(22, Math.max(12, slot / 8))
    const caption = nameSize * 1.25 + CAPTION_BASE + RING + (rows === 1 ? stagger : 0)
    const room = (height - (rows - 1) * ROW_GAP) / rows - caption

    const portraitHeight = Math.min(room, slot * MAX_RATIO)
    const portraitWidth = Math.min(slot, portraitHeight / PILL_RATIO)
    if (portraitWidth <= 0 || portraitHeight <= 0) continue

    if (!best || portraitWidth * portraitHeight > best.portraitWidth * best.portraitHeight) {
      // -1px so float rounding can never push the last member of a row onto the next.
      best = { rows, gap, memberWidth: slot + RING - 1, portraitWidth, portraitHeight, nameSize }
    }
  }
  return best
}

/** Measure the line-up box and re-plan whenever it (or the group) changes size. */
export function useLineupLayout(ref: RefObject<HTMLElement | null>, count: number): LineupLayout | null {
  const [layout, setLayout] = useState<LineupLayout | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || count === 0) return
    const measure = () => {
      const stagger = window.innerHeight * 0.025
      setLayout(planLineup(count, el.clientWidth, el.clientHeight, stagger))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, count])

  return layout
}
