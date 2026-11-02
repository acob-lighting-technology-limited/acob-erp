import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { canAccessAdminSection, resolveAdminScope } from "@/lib/admin/rbac"
import { BirthdaySlideCapture } from "./birthday-slide-capture"

export const metadata: Metadata = { title: "Birthday slide" }

const MMDD_PATTERN = /^\d{2}-\d{2}$/

/**
 * Renders the /birthday spotlight for a fixed period inside a hidden 1920×1080
 * iframe on the General Meeting page, screenshots it, and posts the image to the
 * parent for the agenda deck. Not a page people visit.
 *
 * Same HR gate as /birthday, but reported back to the parent instead of
 * redirecting, so the export can carry on without the birthday slides.
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
  const scope = user ? await resolveAdminScope(supabase, user.id) : null

  let error: string | null = null
  if (!scope || !canAccessAdminSection(scope, "hr")) error = "You need HR access to include birthdays."
  else if ([start, end, upcomingStart, upcomingEnd].some((value) => !MMDD_PATTERN.test(value))) {
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
