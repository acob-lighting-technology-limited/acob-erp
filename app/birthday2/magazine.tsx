"use client"

/* eslint-disable @next/next/no-img-element -- static asset, not optimizable by next/image */

import { useState } from "react"
import { BirthdayEmpty, CelebrantPhoto } from "../birthday/birthday-explorer"
import { cn } from "@/lib/utils"
import { BirthdayBackButton, BirthdayPicker } from "../birthday/birthday-picker"
import { displayName, formatMMDDLabel, isBirthdayToday, splitMMDD } from "../birthday/birthday-utils"
import { useBirthdayCelebrants } from "../birthday/use-birthday-celebrants"
import "./magazine.css"

/** Style 2 — magazine cover: one celebrant as the cover story, the rest as a contents list. */
export function BirthdayMagazine() {
  const state = useBirthdayCelebrants()
  const { celebrants, rangeLabel, isLoading, error } = state
  const [picked, setPicked] = useState<number | null>(null)

  if (!state.isGenerated) {
    return (
      <section className="birthday-hero">
        <BirthdayPicker state={state} />
      </section>
    )
  }

  // Cover story defaults to whoever's birthday is today, else the first in the period.
  const todayIndex = celebrants.findIndex(isBirthdayToday)
  const featuredIndex = picked !== null && picked < celebrants.length ? picked : Math.max(todayIndex, 0)
  const featured = celebrants[featuredIndex]
  const featuredDate = featured ? splitMMDD(featured.birthday) : null

  return (
    <section className="bd2">
      <div className="bd2-cover">
        {featured ? (
          <div key={featuredIndex} className="bd2-cover-inner">
            <CelebrantPhoto celebrant={featured} className="bd2-cover-photo" />
            <div className="bd2-cover-veil" aria-hidden="true" />

            {featuredDate && (
              <div className="bd2-cover-date">
                <span className="bd2-cover-day">{featuredDate.day}</span>
                <span className="bd2-cover-month">{featuredDate.month}</span>
              </div>
            )}

            <div className="bd2-cover-caption">
              <p className="bd2-cover-kicker">{isBirthdayToday(featured) ? "Celebrating today" : "Cover story"}</p>
              <h1 className="bd2-cover-name">{displayName(featured.firstName)}</h1>
              <p className="bd2-cover-dept">{featured.department}</p>
            </div>
          </div>
        ) : error ? (
          <p className="birthday-error">{error}</p>
        ) : (
          <BirthdayEmpty isLoading={isLoading} />
        )}
      </div>

      <aside className="bd2-side">
        <div className="bd2-masthead">
          <img src="/images/acob-logo-dark.webp" alt="ACOB Lighting Logo" className="bd2-logo" />
          <span>Birthday Edition</span>
        </div>
        <p className="bd2-issue">{rangeLabel}</p>

        <p className="bd2-happy">Happy Birthday</p>
        <p className="bd2-lede">
          The ACOB Family celebrates you and appreciates your contributions to the growth of the organisation.
        </p>

        {celebrants.length > 0 && (
          <div className="bd2-contents">
            <p className="bd2-contents-title">
              In this issue <span>{String(celebrants.length).padStart(2, "0")}</span>
            </p>
            <ol className="bd2-list">
              {celebrants.map((celebrant, index) => (
                <li key={`${celebrant.firstName}-${index}`}>
                  <button
                    type="button"
                    className={cn("bd2-entry", index === featuredIndex && "bd2-entry--active")}
                    onClick={() => setPicked(index)}
                    aria-pressed={index === featuredIndex}
                  >
                    <span className="bd2-entry-thumb">
                      <CelebrantPhoto celebrant={celebrant} />
                    </span>
                    <span className="bd2-entry-text">
                      <span className="bd2-entry-name">{displayName(celebrant.firstName)}</span>
                      <span className="bd2-entry-dept">{celebrant.department}</span>
                    </span>
                    <span className="bd2-entry-date">
                      {isBirthdayToday(celebrant) ? "Today" : formatMMDDLabel(celebrant.birthday)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="bd2-signoff">Joy, grace, peace, and a beautiful year ahead.</p>
      </aside>

      <BirthdayBackButton onClick={state.reset} />
    </section>
  )
}
