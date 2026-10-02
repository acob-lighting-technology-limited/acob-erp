"use client"

/* eslint-disable @next/next/no-img-element -- static asset, not optimizable by next/image */

import type { CSSProperties } from "react"
import { BirthdayEmpty, CelebrantPhoto } from "../birthday/birthday-explorer"
import { cn } from "@/lib/utils"
import { BirthdayBackButton, BirthdayPicker } from "../birthday/birthday-picker"
import { displayName, formatMMDDLabel, isBirthdayToday } from "../birthday/birthday-utils"
import { useBirthdayCelebrants } from "../birthday/use-birthday-celebrants"
import "./poster.css"

const HEADLINE = "Birthday"

// One-off confetti burst from the headline. Deterministic so server and client match.
const BURST_COLORS = ["var(--bd-gold)", "var(--bd-cream)", "var(--bd-green)", "var(--bd-gold-deep)"]
const BURST = Array.from({ length: 26 }, (_, i) => {
  const angle = (i / 26) * Math.PI * 2 + ((i * 37) % 10) / 20
  const distance = 170 + ((i * 53) % 160)
  return {
    dx: Math.round(Math.cos(angle) * distance * 1.5),
    dy: Math.round(Math.sin(angle) * distance * 0.7),
    spin: ((i * 97) % 540) - 270,
    color: BURST_COLORS[i % BURST_COLORS.length],
    long: i % 3 !== 0,
  }
})

const SPARKLES = [
  { left: "-4%", top: "18%", delay: "2.4s" },
  { left: "103%", top: "28%", delay: "3.6s" },
  { left: "8%", top: "96%", delay: "4.8s" },
  { left: "94%", top: "88%", delay: "6s" },
]

/** Style 1 — event poster: giant headline, a staggered line-up of portraits, a ticket stub. */
export function BirthdayPoster() {
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
    <section className="bd1">
      <img src="/images/acob-logo-dark.webp" alt="ACOB Lighting Logo" className="bd1-logo" />

      <header className="bd1-top">
        <span className="bd1-presents">The ACOB Family presents</span>
      </header>

      <h1 className="bd1-headline" aria-label="Happy Birthday">
        <span className="bd1-happy" aria-hidden="true">
          Happy
        </span>
        <span className="bd1-birthday" aria-hidden="true">
          {HEADLINE.split("").map((letter, i) => (
            <span key={i} className="bd1-letter" style={{ "--l": i } as CSSProperties}>
              {letter}
            </span>
          ))}
        </span>

        <span className="bd1-burst" aria-hidden="true">
          {BURST.map((piece, i) => (
            <span
              key={i}
              className={cn("bd1-burst-piece", piece.long && "bd1-burst-piece--long")}
              style={
                {
                  "--dx": `${piece.dx}px`,
                  "--dy": `${piece.dy}px`,
                  "--spin": `${piece.spin}deg`,
                  background: piece.color,
                } as CSSProperties
              }
            />
          ))}
        </span>

        {SPARKLES.map((sparkle, i) => (
          <span
            key={i}
            className="bd1-sparkle"
            style={{ left: sparkle.left, top: sparkle.top, animationDelay: sparkle.delay }}
            aria-hidden="true"
          />
        ))}
      </h1>

      {error ? (
        <p className="birthday-error">{error}</p>
      ) : celebrants.length > 0 ? (
        <div className="bd1-lineup" style={{ "--n": celebrants.length } as CSSProperties}>
          {celebrants.map((celebrant, index) => {
            const isToday = isBirthdayToday(celebrant)
            return (
              <figure
                key={`${celebrant.firstName}-${index}`}
                className={cn("bd1-member", isToday && "bd1-member--today")}
                style={{ "--i": index } as CSSProperties}
              >
                <div className="bd1-portrait">
                  <CelebrantPhoto celebrant={celebrant} />
                </div>
                <figcaption>
                  <span className="bd1-member-name">{displayName(celebrant.firstName)}</span>
                  <span className="bd1-member-date">{isToday ? "Today" : formatMMDDLabel(celebrant.birthday)}</span>
                </figcaption>
              </figure>
            )
          })}
        </div>
      ) : (
        <BirthdayEmpty isLoading={isLoading} />
      )}

      <div className="bd1-ticket">
        <div className="bd1-ticket-stub">
          <span>Celebrating</span>
          <strong>{rangeLabel}</strong>
        </div>
        <p className="bd1-ticket-wish">
          Wishing you joy, grace, peace, and a beautiful year ahead — thank you for all you bring to ACOB.
        </p>
      </div>

      <BirthdayBackButton onClick={state.reset} />
    </section>
  )
}
