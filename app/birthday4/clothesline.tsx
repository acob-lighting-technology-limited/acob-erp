"use client"

/* eslint-disable @next/next/no-img-element -- static asset, not optimizable by next/image */

import type { CSSProperties } from "react"
import { BirthdayEmpty, CelebrantPhoto } from "../birthday/birthday-explorer"
import { cn } from "@/lib/utils"
import { BirthdayBackButton, BirthdayPicker } from "../birthday/birthday-picker"
import {
  displayName,
  formatMMDDLabel,
  formatNamesList,
  isBirthdayToday,
  type Celebrant,
} from "../birthday/birthday-utils"
import { useBirthdayCelebrants } from "../birthday/use-birthday-celebrants"
import "./clothesline.css"

// One rope wherever faces stay readable; a second rope only beyond this.
const MAX_PER_LINE = 8

/** Split celebrants into evenly-filled lines of at most MAX_PER_LINE, keeping each line's start index. */
function toLines(celebrants: Celebrant[]): { start: number; items: Celebrant[] }[] {
  const lineCount = Math.ceil(celebrants.length / MAX_PER_LINE)
  const perLine = Math.ceil(celebrants.length / Math.max(lineCount, 1))
  const lines: { start: number; items: Celebrant[] }[] = []
  for (let i = 0; i < celebrants.length; i += perLine) lines.push({ start: i, items: celebrants.slice(i, i + perLine) })
  return lines
}

/**
 * The rope is a quadratic curve from (0, 2) through control (50, 98) to (100, 2) in a
 * 0–100 box, so at fraction t along it the rope sits at y = 2 + 192·t·(1−t) percent.
 */
function ropeDrop(t: number): number {
  return (2 + 192 * t * (1 - t)) / 100
}

/** Style 4 — clothesline: portraits pegged to swaying ropes strung across the screen. */
export function BirthdayClothesline() {
  const state = useBirthdayCelebrants()
  const { celebrants, rangeLabel, isLoading, error } = state

  if (!state.isGenerated) {
    return (
      <section className="birthday-hero">
        <BirthdayPicker state={state} />
      </section>
    )
  }

  const lines = toLines(celebrants)

  return (
    <section className="bd4">
      <header className="bd4-head">
        <img src="/images/acob-logo-dark.webp" alt="ACOB Lighting Logo" className="bd4-logo" />
      </header>

      {error ? (
        <p className="birthday-error">{error}</p>
      ) : celebrants.length > 0 ? (
        <div className="bd4-lines" style={{ "--lines": lines.length } as CSSProperties}>
          {lines.map((line) => (
            <div key={line.start} className="bd4-line" style={{ "--count": line.items.length } as CSSProperties}>
              <svg className="bd4-rope" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 2 Q50 98 100 2" />
              </svg>

              {line.items.map((celebrant, i) => {
                const t = (i + 1) / (line.items.length + 1)
                const isToday = isBirthdayToday(celebrant)
                const order = line.start + i
                return (
                  <figure
                    key={`${celebrant.firstName}-${order}`}
                    className={cn("bd4-pin", isToday && "bd4-pin--today")}
                    style={
                      {
                        left: `${t * 100}%`,
                        top: `calc(var(--sag) * ${ropeDrop(t)})`,
                        "--i": order,
                      } as CSSProperties
                    }
                  >
                    <span className="bd4-peg" aria-hidden="true" />
                    <div className="bd4-frame">
                      <div className="bd4-photo">
                        <CelebrantPhoto celebrant={celebrant} />
                      </div>
                      <figcaption>
                        <span className="bd4-name">{displayName(celebrant.firstName)}</span>
                        <span className="bd4-date">{isToday ? "Today" : formatMMDDLabel(celebrant.birthday)}</span>
                      </figcaption>
                    </div>
                  </figure>
                )
              })}
            </div>
          ))}
        </div>
      ) : (
        <BirthdayEmpty isLoading={isLoading} />
      )}

      <footer className="bd4-foot">
        <p className="bd4-happy">Happy Birthday</p>
        {celebrants.length > 0 && (
          <h1 className="bd4-names">{formatNamesList(celebrants.map((c) => displayName(c.firstName)))}</h1>
        )}
        <p className="bd4-wish">
          The ACOB Family celebrates you — wishing you joy, grace, peace, and a beautiful year ahead.
        </p>
        <span className="bd4-range">{rangeLabel}</span>
      </footer>

      <BirthdayBackButton onClick={state.reset} />
    </section>
  )
}
