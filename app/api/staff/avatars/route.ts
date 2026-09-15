import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getAvatarSignedUrls } from "@/lib/profile-photos"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"
const log = logger("staff-avatars")

/**
 * `{ [profileId]: signedUrl }` for every current staff member with a photo.
 *
 * Profile photos live in a private bucket, so any surface that shows people (assignees,
 * leave requests, meeting presenters) needs them signed server-side. One org-wide map,
 * cached client-side by `useStaffAvatars`, replaces a signing call per page. Exposure
 * matches `/api/directory`, which already shows every employee their colleagues' photos.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(`staff-avatars:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data: rows, error } = await dataClient
    .from("profiles")
    .select("id, avatar_path, employment_status")
    .not("avatar_path", "is", null)

  if (error) {
    log.error({ err: error.message }, "Failed to load staff avatars")
    return NextResponse.json({ error: "Failed to load avatars" }, { status: 500 })
  }

  const profiles = (
    (rows ?? []) as { id: string; avatar_path: string | null; employment_status: string | null }[]
  ).filter((p) => p.employment_status !== "exited")
  const signedUrlsByPath = await getAvatarSignedUrls(
    dataClient,
    profiles.map((p) => p.avatar_path).filter((path): path is string => Boolean(path))
  )

  const data: Record<string, string> = {}
  for (const profile of profiles) {
    const signed = profile.avatar_path ? signedUrlsByPath.get(profile.avatar_path) : undefined
    if (signed) data[profile.id] = signed
  }

  return NextResponse.json({ data })
}
