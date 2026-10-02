import { BirthdayDecor } from "./birthday-decor"
import { BirthdayExplorer } from "./birthday-explorer"
import { birthdayScript, birthdaySerif } from "./fonts"
import "./birthday.css"
import "./birthday-variants.css"

/** Style options under review at /birthday1–/birthday5; markup is shared, only birthday-variants.css differs. */
export type BirthdayVariant = 1 | 2 | 3 | 4 | 5

export function BirthdaySpotlight({ variant }: { variant?: BirthdayVariant }) {
  return (
    <main className={`birthday-page ${birthdayScript.variable} ${birthdaySerif.variable}`} data-variant={variant}>
      <BirthdayDecor />

      <section className="birthday-hero">
        <BirthdayExplorer />
      </section>
    </main>
  )
}
