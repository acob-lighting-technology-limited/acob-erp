import { Cake } from "lucide-react"
import { BirthdayDecor } from "./birthday-decor"

export default function Loading() {
  return (
    <main className="birthday-page">
      <BirthdayDecor />

      <section className="birthday-hero">
        <div className="birthday-setup-container">
          <div className="birthday-setup-card" aria-busy="true">
            <div className="birthday-setup-icon">
              <Cake className="h-7 w-7" />
            </div>
            <p className="birthday-script">Getting the party ready…</p>
            <div className="birthday-skeleton h-10 w-full" />
            <div className="birthday-skeleton h-10 w-full" />
            <div className="birthday-skeleton h-11 w-full" />
          </div>
        </div>
      </section>
    </main>
  )
}
