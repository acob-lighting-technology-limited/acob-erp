"use client"

/* eslint-disable @next/next/no-img-element -- static asset, not optimizable by next/image */

import type { CSSProperties, ReactNode } from "react"
import { Gift } from "lucide-react"
import { BirthdayEmpty, CelebrantPhoto } from "./birthday-explorer"
import { cn } from "@/lib/utils"
import { BirthdayBackButton, BirthdayPicker } from "./birthday-picker"
import {
  displayName,
  formatMMDDLabel,
  formatNamesList,
  isBirthdayToday,
  type Celebrant,
  type UpcomingBirthdays,
} from "./birthday-utils"
import { useBirthdayCelebrants } from "./use-birthday-celebrants"
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

/**
 * Clothesline spotlight. "rope" pegs the cards to swaying ropes strung across the
 * screen (/birthday4); "cards" sets them level in a centred row (/birthday).
 */
export function BirthdayClothesline({ layout }: { layout: "rope" | "cards" }) {
  const state = useBirthdayCelebrants()
  const { celebrants, rangeLabel, isLoading, error } = state

  if (!state.isGenerated) {
    return (
      <section className="birthday-hero">
        <BirthdayPicker state={state} />
      </section>
    )
  }

  return (
    <BirthdayClotheslineStage
      layout={layout}
      celebrants={celebrants}
      rangeLabel={rangeLabel}
      isLoading={isLoading}
      error={error}
      upcoming={state.upcoming}
    >
      <BirthdayBackButton onClick={state.reset} />
    </BirthdayClotheslineStage>
  )
}

/** Bottom-right summary of the week after the spotlight period, so the next celebrants get a mention. */
function BirthdayUpcoming({ upcoming }: { upcoming: UpcomingBirthdays }) {
  return (
    <aside className="bd4-upcoming" aria-label="Upcoming birthdays">
      <p className="bd4-upcoming-title">Coming up</p>
      <p className="bd4-upcoming-range">{upcoming.label}</p>
      {upcoming.celebrants.length > 0 ? (
        <ul className="bd4-upcoming-list">
          {upcoming.celebrants.map((celebrant, i) => (
            <li key={`${celebrant.firstName}-${i}`}>
              <span className="bd4-upcoming-avatar">
                <CelebrantPhoto celebrant={celebrant} />
              </span>
              <span className="bd4-upcoming-name">{displayName(celebrant.firstName)}</span>
              <span className="bd4-upcoming-date">{formatMMDDLabel(celebrant.birthday)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bd4-upcoming-empty">No birthdays this week</p>
      )}
    </aside>
  )
}

/**
 * The spotlight itself, without the period picker. Also rendered by
 * /birthday/slide, which screenshots it for the general-meeting agenda deck —
 * that copy passes highlightToday={false}, since "Today" would mean the export day.
 */
export function BirthdayClotheslineStage({
  layout,
  celebrants,
  rangeLabel,
  isLoading = false,
  error = null,
  highlightToday = true,
  upcoming = null,
  emptyLabel = "No birthdays",
  children,
}: {
  layout: "rope" | "cards"
  celebrants: Celebrant[]
  rangeLabel: string
  upcoming?: UpcomingBirthdays | null
  isLoading?: boolean
  error?: string | null
  highlightToday?: boolean
  /** The quiet line shown when the period has no celebrants. */
  emptyLabel?: string
  children?: ReactNode
}) {
  const lines = toLines(celebrants)

  return (
    <section className={cn("bd4", layout === "cards" && "bd4--static")}>
      <header className="bd4-head">
        <img src="/images/acob-logo-dark.webp" alt="ACOB Lighting Logo" className="bd4-logo" />
      </header>

      {error ? (
        <p className="birthday-error">{error}</p>
      ) : celebrants.length > 0 ? (
        <div className="bd4-lines" style={{ "--lines": lines.length } as CSSProperties}>
          {lines.map((line, lineIndex) => (
            <div
              key={line.start}
              className="bd4-line"
              style={{ "--count": line.items.length, "--li": lineIndex } as CSSProperties}
            >
              <svg className="bd4-rope" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 2 Q50 98 100 2" />
              </svg>

              {line.items.map((celebrant, i) => {
                const t = (i + 1) / (line.items.length + 1)
                const isToday = highlightToday && isBirthdayToday(celebrant)
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
      ) : isLoading ? (
        <BirthdayEmpty isLoading />
      ) : (
        // Deliberately understated: no frame, no "Happy Birthday", the "Coming up"
        // summary in the corner carries the screen.
        <div className="bd4-none">
          <Gift className="bd4-none-icon" strokeWidth={1.25} aria-hidden="true" />
          <p className="bd4-none-label">{emptyLabel}</p>
          <span className="bd4-range">{rangeLabel}</span>
        </div>
      )}

      {celebrants.length > 0 && (
        <footer className="bd4-foot">
          <p className="bd4-happy">Happy Birthday</p>
          <h1 className="bd4-names">{formatNamesList(celebrants.map((c) => displayName(c.firstName)))}</h1>
          <p className="bd4-wish">
            The ACOB Family celebrates you — wishing you joy, grace, peace, and a beautiful year ahead.
          </p>
          <span className="bd4-range">{rangeLabel}</span>
        </footer>
      )}

      {upcoming && <BirthdayUpcoming upcoming={upcoming} />}

      {children}
    </section>
  )
}
