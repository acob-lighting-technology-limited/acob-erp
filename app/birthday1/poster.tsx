"use client"

/* eslint-disable @next/next/no-img-element -- static asset, not optimizable by next/image */

import type { CSSProperties } from "react"
import { BirthdayEmpty, CelebrantPhoto } from "../birthday/birthday-explorer"
import { cn } from "@/lib/utils"
import { BirthdayBackButton, BirthdayPicker } from "../birthday/birthday-picker"
import { displayName, formatMMDDLabel, isBirthdayToday } from "../birthday/birthday-utils"
import { useBirthdayCelebrants } from "../birthday/use-birthday-celebrants"
import "./poster.css"

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
      <header className="bd1-top">
        <img src="/images/acob-logo-dark.webp" alt="ACOB Lighting Logo" className="bd1-logo" />
        <span className="bd1-presents">The ACOB Family presents</span>
      </header>

      <h1 className="bd1-headline">
        <span className="bd1-happy">Happy</span>
        <span className="bd1-birthday">Birthday</span>
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
