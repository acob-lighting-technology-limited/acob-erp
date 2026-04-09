import Image from "next/image"
import { redirect } from "next/navigation"
import { Sparkles, Stars } from "lucide-react"
import { createClient } from "@/lib/supabase/server"

type Celebrant = {
  displayName: string
  imageSrc: string
}

function getPreviousWeekRangeLabel() {
  const today = new Date()
  const mondayIndex = (today.getDay() + 6) % 7

  const startOfThisWeek = new Date(today)
  startOfThisWeek.setHours(0, 0, 0, 0)
  startOfThisWeek.setDate(today.getDate() - mondayIndex)

  const startOfPreviousWeek = new Date(startOfThisWeek)
  startOfPreviousWeek.setDate(startOfThisWeek.getDate() - 7)

  const endOfPreviousWeek = new Date(startOfThisWeek)
  endOfPreviousWeek.setDate(startOfThisWeek.getDate() - 1)

  const sameMonth = startOfPreviousWeek.getMonth() === endOfPreviousWeek.getMonth()
  const sameYear = startOfPreviousWeek.getFullYear() === endOfPreviousWeek.getFullYear()

  const startFormatter = new Intl.DateTimeFormat("en-NG", {
    month: "long",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })

  const endFormatter = new Intl.DateTimeFormat("en-NG", {
    month: sameMonth && sameYear ? undefined : "long",
    day: "numeric",
    year: "numeric",
  })

  return {
    start: startFormatter.format(startOfPreviousWeek),
    end: endFormatter.format(endOfPreviousWeek),
  }
}

export default async function BirthdayPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/auth/login")
  }

  await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, full_name")
      .eq("first_name", "Anointed")
      .eq("last_name", "Emoghene")
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("first_name, last_name, full_name")
      .eq("first_name", "Joshua")
      .eq("last_name", "Ibe")
      .maybeSingle(),
  ])

  const celebrants: Celebrant[] = [
    {
      displayName: "Ann",
      imageSrc: "/images/birthday/annointed-birthday.jpeg",
    },
    {
      displayName: "Joshua",
      imageSrc: "/images/birthday/joshua-ibe.jpeg",
    },
  ]

  const previousWeekRange = getPreviousWeekRangeLabel()

  return (
    <main className="birthday-page">
      <div className="birthday-page__ambient" aria-hidden="true" />
      <div className="birthday-page__ambient birthday-page__ambient--secondary" aria-hidden="true" />

      <section className="birthday-hero">
        <div className="birthday-hero__copy">
          <div className="birthday-kicker">
            <Sparkles className="h-4 w-4" />
            Weekly Birthday Spotlight
          </div>

          <div className="birthday-copy-stack">
            <p className="birthday-overline">Celebrating last week&apos;s birthdays this week</p>
            <h1 className="birthday-title">Mr. Joshua Ibe and Miss Ann Emoghene</h1>
            <p className="birthday-subtitle">
              ACOB Family celebrates you today and we appreciate your contributions to the growth of the organisation.
            </p>
          </div>

          <div className="birthday-meta-grid">
            <div className="birthday-meta-card">
              <span className="birthday-meta-label">Featured Week</span>
              <strong className="birthday-week-range">
                <span>{previousWeekRange.start}</span>
                <span aria-hidden="true">-</span>
                <span>{previousWeekRange.end}</span>
              </strong>
            </div>
            <div className="birthday-meta-card">
              <span className="birthday-meta-label">Message</span>
              <strong>Wishing you both joy, grace, peace, and a beautiful year ahead</strong>
            </div>
          </div>
        </div>

        <div className="birthday-hero__visual birthday-grid">
          {celebrants.map((celebrant) => (
            <article key={celebrant.displayName} className="birthday-photo-shell">
              <Image
                src={celebrant.imageSrc}
                alt={celebrant.displayName}
                fill
                priority
                sizes="(max-width: 1100px) 100vw, 36vw"
                className="birthday-photo"
              />
              <div className="birthday-photo__veil" aria-hidden="true" />
              <div className="birthday-photo__content">
                <div className="birthday-photo__badge">
                  <Stars className="h-4 w-4" />
                  ACOB Celebrates You
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
