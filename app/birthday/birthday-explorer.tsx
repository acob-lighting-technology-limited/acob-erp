"use client"

/* eslint-disable @next/next/no-img-element -- signed URLs / static asset, not optimizable by next/image */

import { Cake, CalendarHeart, Gift, Heart, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { BirthdayBackButton, BirthdayPicker } from "./birthday-picker"
import { displayName, formatMMDDLabel, formatNamesList, isBirthdayToday } from "./birthday-utils"
import { useBirthdayCelebrants } from "./use-birthday-celebrants"

/** Roughly-square column count so N cards form a balanced grid instead of one stretched row. */
function columnsForCount(count: number): number {
  if (count <= 1) return 1
  return Math.min(4, Math.ceil(Math.sqrt(count)))
}

export function BirthdayExplorer() {
  const state = useBirthdayCelebrants()
  const { celebrants, rangeLabel, isLoading, error } = state

  if (!state.isGenerated) return <BirthdayPicker state={state} />

  const celebrantsTitle = formatNamesList(celebrants.map((c) => displayName(c.firstName)))
  const gridColumns = columnsForCount(celebrants.length)

  return (
    <>
      <div className="birthday-hero__copy">
        <img src="/images/acob-logo-dark.webp" alt="ACOB Lighting Logo" className="birthday-logo" />

        <div className="birthday-kicker">
          <Sparkles className="h-4 w-4" />
          Birthday Spotlight
        </div>

        <div className="birthday-copy-stack">
          <p className="birthday-script birthday-script--hero">Happy Birthday</p>
          <h1 className="birthday-title">{celebrantsTitle || "Choose a range"}</h1>
          <p className="birthday-subtitle">
            ACOB Family celebrates all of you and appreciates your contributions to the growth of the organisation.
          </p>
        </div>

        <div className="birthday-meta-grid">
          <div className="birthday-meta-card">
            <span className="birthday-meta-label">
              <CalendarHeart className="h-4 w-4" />
              Celebrating
            </span>
            <strong className="birthday-week-range">{rangeLabel || "—"}</strong>
          </div>
          <div className="birthday-meta-card birthday-meta-card--wish">
            <span className="birthday-meta-label">
              <Heart className="h-4 w-4" />
              Our wish for you
            </span>
            <strong>Joy, grace, peace, and a beautiful year ahead</strong>
          </div>
        </div>
      </div>

      <div className="birthday-hero__visual">
        {error ? (
          <p className="birthday-error">{error}</p>
        ) : celebrants.length > 0 ? (
          <div className="birthday-grid" style={{ "--birthday-cols": gridColumns } as React.CSSProperties}>
            {celebrants.map((celebrant, index) => {
              const isToday = isBirthdayToday(celebrant)
              return (
                <article
                  key={`${celebrant.firstName}-${index}`}
                  className={cn("birthday-card-item", isToday && "birthday-card-item--today")}
                  style={{ "--i": index } as React.CSSProperties}
                >
                  <div className="birthday-card-photo-wrapper">
                    <CelebrantPhoto celebrant={celebrant} />
                    <div className="birthday-photo__veil" aria-hidden="true" />
                    <div className="birthday-photo__badge">
                      {isToday ? <Cake className="h-3.5 w-3.5" /> : <Gift className="h-3.5 w-3.5" />}
                      {isToday ? "Today" : formatMMDDLabel(celebrant.birthday)}
                    </div>
                  </div>
                  <div className="birthday-card-details">
                    <h3 className="birthday-card-name">{displayName(celebrant.firstName)}</h3>
                    <p className="birthday-card-dept">{celebrant.department}</p>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <BirthdayEmpty isLoading={isLoading} />
        )}
      </div>

      <BirthdayBackButton onClick={state.reset} />
    </>
  )
}

export function BirthdayEmpty({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="birthday-empty">
      {isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin" />
      ) : (
        <>
          <Gift className="h-9 w-9" />
          <p>No birthdays in this period</p>
          <span>Try another week or month.</span>
        </>
      )}
    </div>
  )
}

/** Photo or initial fallback, filling its (positioned) parent. Used by every design. */
export function CelebrantPhoto({
  celebrant,
  className,
}: {
  celebrant: { firstName: string; avatarUrl: string | null }
  className?: string
}) {
  const name = displayName(celebrant.firstName)
  return celebrant.avatarUrl ? (
    <img src={celebrant.avatarUrl} alt={name} className={cn("birthday-photo", className)} />
  ) : (
    <div className={cn("birthday-photo-placeholder", className)}>
      <span>{name.charAt(0)}</span>
    </div>
  )
}
