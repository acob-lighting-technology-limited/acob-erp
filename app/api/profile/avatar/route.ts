import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import {
  AVATAR_CACHE_CONTROL_SECONDS,
  AVATAR_LARGE_MAX_PX,
  AVATAR_SIZE_PX,
  avatarObjectPaths,
  buildAvatarStoragePath,
  getAvatarSignedUrl,
  largeAvatarPath,
  PROFILE_PHOTOS_BUCKET,
} from "@/lib/profile-photos"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const log = logger("profile-avatar")

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"])
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  const rl = await rateLimit(`profile-avatar:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Use JPEG, PNG, or WebP." }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large. Maximum size is 5MB." }, { status: 400 })
  }

  // Phone photos arrive at several MB. Store two WebPs instead of the original: a
  // small square thumbnail for every avatar (never shown above 64px) and an
  // uncropped copy for the birthday showcase. `rotate()` applies EXIF orientation.
  let thumb: Buffer
  let large: Buffer
  try {
    const source = sharp(Buffer.from(await file.arrayBuffer())).rotate()
    ;[thumb, large] = await Promise.all([
      source.clone().resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, { fit: "cover" }).webp({ quality: 80 }).toBuffer(),
      source
        .clone()
        .resize(AVATAR_LARGE_MAX_PX, AVATAR_LARGE_MAX_PX, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer(),
    ])
  } catch (err) {
    log.warn({ err: String(err) }, "Could not decode profile photo")
    return NextResponse.json({ error: "Could not read that image. Try a different photo." }, { status: 400 })
  }

  const dataClient = getServiceRoleClientOrFallback(supabase)
  const bucket = dataClient.storage.from(PROFILE_PHOTOS_BUCKET)
  const avatarPath = buildAvatarStoragePath(user.id)
  const newObjects = avatarObjectPaths(avatarPath)

  const { data: previous } = await dataClient.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle()

  const uploadOptions = { contentType: "image/webp", cacheControl: AVATAR_CACHE_CONTROL_SECONDS }
  const uploads = await Promise.all([
    bucket.upload(avatarPath, thumb, uploadOptions),
    bucket.upload(largeAvatarPath(avatarPath), large, uploadOptions),
  ])
  const uploadError = uploads.find((u) => u.error)?.error

  if (uploadError) {
    log.error({ err: String(uploadError) }, "Failed to upload profile photo")
    await bucket.remove(newObjects)
    return NextResponse.json({ error: "Failed to upload photo" }, { status: 500 })
  }

  const { error: updateError } = await dataClient.from("profiles").update({ avatar_path: avatarPath }).eq("id", user.id)

  if (updateError) {
    log.error({ err: String(updateError) }, "Failed to save avatar_path")
    await bucket.remove(newObjects)
    return NextResponse.json({ error: "Failed to save photo" }, { status: 500 })
  }

  if (previous?.avatar_path && previous.avatar_path !== avatarPath) {
    const { error: removeError } = await bucket.remove(avatarObjectPaths(previous.avatar_path))
    if (removeError) log.warn({ err: String(removeError) }, "Failed to remove previous profile photo")
  }

  const signedUrl = await getAvatarSignedUrl(dataClient, avatarPath)

  return NextResponse.json({ data: { avatarUrl: signedUrl } })
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data: profile } = await dataClient.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle()

  const signedUrl = profile?.avatar_path ? await getAvatarSignedUrl(dataClient, profile.avatar_path) : null

  return NextResponse.json({ data: { avatarUrl: signedUrl } })
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dataClient = getServiceRoleClientOrFallback(supabase)

  const { data: profile } = await dataClient.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle()

  if (profile?.avatar_path) {
    await dataClient.storage.from(PROFILE_PHOTOS_BUCKET).remove(avatarObjectPaths(profile.avatar_path))
  }

  const { error: updateError } = await dataClient.from("profiles").update({ avatar_path: null }).eq("id", user.id)

  if (updateError) {
    log.error({ err: String(updateError) }, "Failed to clear avatar_path")
    return NextResponse.json({ error: "Failed to remove photo" }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } })
}
