import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getAvatarSignedUrls } from "@/lib/profile-photos"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { serverError } from "@/lib/api/errors"
import { MMDD_PATTERN, birthdayRangeDays, isBirthdayInRange } from "@/lib/hr/birthdays"

const log = logger("api-reports-meeting-birthdays")

/** The agenda deck's birthday slide covers a week either side of the meeting. */
const MAX_RANGE_DAYS = 7

/**
 * Birthdays for one week, for the general-meeting agenda deck's birthday
 * slide, which any staff member may export. Unlike /api/admin/hr/birthdays
 * (HR only, any range, full names and departments) this returns only what the
 * slide shows the whole room: first name, day and month (never the year) and
 * the photo, for at most seven days at a time.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(`meeting-birthdays:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const start = searchParams.get("start") || ""
  const end = searchParams.get("end") || ""
  const photoSize = searchParams.get("photo") === "large" ? "large" : "thumb"
  if (!MMDD_PATTERN.test(start) || !MMDD_PATTERN.test(end)) {
    return NextResponse.json({ error: "start and end must be MM-DD" }, { status: 400 })
  }
  if (birthdayRangeDays(start, end) > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `The range can cover at most ${MAX_RANGE_DAYS} days` }, { status: 400 })
  }

  // profiles RLS shows an employee only their own row, so read with the service role.
  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data: profiles, error } = await dataClient
    .from("profiles")
    .select("first_name, birthday, avatar_path")
    .eq("employment_status", "active")
    .not("birthday", "is", null)
  if (error) return serverError(log, error)

  const matches = (profiles || []).filter((p) => p.birthday && isBirthdayInRange(p.birthday, start, end))
  const avatarPaths = matches.map((p) => p.avatar_path).filter((path): path is string => Boolean(path))
  const signedUrlsByPath = await getAvatarSignedUrls(dataClient, avatarPaths, photoSize)

  const celebrants = matches
    .map((p) => ({
      firstName: p.first_name || "",
      birthday: p.birthday as string,
      avatarUrl: p.avatar_path ? (signedUrlsByPath.get(p.avatar_path) ?? null) : null,
    }))
    .sort((a, b) => a.birthday.localeCompare(b.birthday))

  return NextResponse.json({ data: celebrants })
}
