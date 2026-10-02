import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { BirthdayDecor } from "./birthday-decor"
import { BirthdayExplorer } from "./birthday-explorer"
import { birthdayScript, birthdaySerif } from "./fonts"
import "./birthday.css"
import "./birthday-variants.css"

/** Page frame shared by every spotlight design: palette tokens, fonts, bunting/balloons/confetti. */
export function BirthdayShell({
  className,
  variant,
  children,
}: {
  className?: string
  variant?: number
  children: ReactNode
}) {
  return (
    <main
      className={cn("birthday-page", birthdayScript.variable, birthdaySerif.variable, className)}
      data-variant={variant}
    >
      <BirthdayDecor />
      {children}
    </main>
  )
}

/** The original card-grid spotlight (/birthday, and /birthday3 with variant 3 styling). */
export function BirthdaySpotlight({ variant }: { variant?: 3 }) {
  return (
    <BirthdayShell variant={variant}>
      <section className="birthday-hero">
        <BirthdayExplorer />
      </section>
    </BirthdayShell>
  )
}
