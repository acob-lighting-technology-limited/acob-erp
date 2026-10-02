"use client"

/* eslint-disable @next/next/no-img-element -- static asset, not optimizable by next/image */

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { BirthdayEmpty, CelebrantPhoto } from "../birthday/birthday-explorer"
import { BirthdayBackButton, BirthdayPicker } from "../birthday/birthday-picker"
import { displayName, isBirthdayToday, splitMMDD } from "../birthday/birthday-utils"
import { useBirthdayCelebrants } from "../birthday/use-birthday-celebrants"
import "./slideshow.css"

const SLIDE_MS = 7000

/** Style 5 — presentation slideshow: one celebrant at a time, full screen, auto-advancing. */
export function BirthdaySlideshow() {
  const state = useBirthdayCelebrants()
  const { celebrants, rangeLabel, isLoading, error } = state
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)

  const count = celebrants.length
  const current = count > 0 ? celebrants[index % count] : null

  const go = (delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0))

  // Restarting the timer on every index change means a manual skip gets a full slide too.
  useEffect(() => {
    if (!state.isGenerated || !playing || count < 2) return
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS)
    return () => window.clearTimeout(timer)
  }, [state.isGenerated, playing, count, index])

  useEffect(() => {
    if (!state.isGenerated || count < 2) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count)
      else if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count)
      else if (e.key === " ") {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state.isGenerated, count])

  if (!state.isGenerated) {
    return (
      <section className="birthday-hero">
        <BirthdayPicker state={state} />
      </section>
    )
  }

  const date = current ? splitMMDD(current.birthday) : null
  const isToday = current ? isBirthdayToday(current) : false

  return (
    <section className="bd5">
      <header className="bd5-top">
        <img src="/images/acob-logo-dark.webp" alt="ACOB Lighting Logo" className="bd5-logo" />
        <span className="bd5-range">{rangeLabel}</span>
      </header>

      {error ? (
        <p className="birthday-error">{error}</p>
      ) : current && date ? (
        <div key={index % count} className="bd5-stage">
          <div className={cn("bd5-portrait", isToday && "bd5-portrait--today")}>
            <span className="bd5-ring" aria-hidden="true" />
            <div className="bd5-photo">
              <CelebrantPhoto celebrant={current} />
            </div>
          </div>

          <div className="bd5-copy">
            <p className="bd5-happy">Happy Birthday</p>
            <h1 className="bd5-name">{displayName(current.firstName)}</h1>
            <p className="bd5-dept">{current.department}</p>

            <div className="bd5-date">
              {isToday ? (
                <span className="bd5-today">Today</span>
              ) : (
                <>
                  <span className="bd5-day">{date.day}</span>
                  <span className="bd5-month">{date.month}</span>
                </>
              )}
            </div>

            <p className="bd5-wish">
              The ACOB Family celebrates you. Wishing you joy, grace, peace, and a beautiful year ahead.
            </p>
          </div>
        </div>
      ) : (
        <div className="bd5-stage bd5-stage--empty">
          <BirthdayEmpty isLoading={isLoading} />
        </div>
      )}

      {count > 1 && (
        <nav className="bd5-rail" aria-label="Celebrants">
          <button type="button" className="bd5-ctrl" onClick={() => go(-1)} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="bd5-thumbs">
            {celebrants.map((celebrant, i) => (
              <button
                key={`${celebrant.firstName}-${i}`}
                type="button"
                className={cn("bd5-thumb", i === index % count && "bd5-thumb--active")}
                onClick={() => setIndex(i)}
                aria-label={displayName(celebrant.firstName)}
                aria-current={i === index % count}
              >
                <CelebrantPhoto celebrant={celebrant} />
              </button>
            ))}
          </div>

          <button type="button" className="bd5-ctrl" onClick={() => go(1)} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="bd5-ctrl"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          <span
            key={`${index}-${playing}`}
            className={cn("bd5-progress", !playing && "bd5-progress--paused")}
            style={{ animationDuration: `${SLIDE_MS}ms` }}
            aria-hidden="true"
          />
        </nav>
      )}

      <BirthdayBackButton onClick={state.reset} />
    </section>
  )
}
