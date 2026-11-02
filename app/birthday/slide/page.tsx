import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { MMDD_PATTERN, birthdayRangeDays } from "@/lib/hr/birthdays"
import { BirthdaySlideCapture } from "./birthday-slide-capture"

export const metadata: Metadata = { title: "Birthday slide" }

/**
 * Renders the /birthday spotlight for a fixed period inside a hidden 1920×1080
 * iframe on the General Meeting page, screenshots it, and posts the image to the
 * parent for the agenda deck. Not a page people visit.
 *
 * Any signed-in staff member may export the deck, so unlike /birthday this is
 * not HR-only: it shows what the meeting shows everyone, one week either side
 * (see /api/reports/meeting-birthdays). Problems are reported back to the
 * parent instead of redirecting, so the export carries on without the slide.
 */
export default async function BirthdaySlidePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const read = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "")
  const start = read("start")
  const end = read("end")
  const label = read("label").slice(0, 80)
  const upcomingStart = read("upStart")
  const upcomingEnd = read("upEnd")
  const upcomingLabel = read("upLabel").slice(0, 80)
  const captureId = read("id").slice(0, 64)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let error: string | null = null
  if (!user) error = "Sign in to include birthdays."
  else if (
    [start, end, upcomingStart, upcomingEnd].some((value) => !MMDD_PATTERN.test(value)) ||
    birthdayRangeDays(start, end) > 7 ||
    birthdayRangeDays(upcomingStart, upcomingEnd) > 7
  ) {
    error = "Invalid birthday period."
  }

  return (
    <BirthdaySlideCapture
      period={{ start, end, label }}
      upcomingPeriod={{ start: upcomingStart, end: upcomingEnd, label: upcomingLabel }}
      captureId={captureId}
      accessError={error}
    />
  )
}
