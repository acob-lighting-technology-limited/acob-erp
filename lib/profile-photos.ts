import { unstable_cache } from "next/cache"
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js"

export const PROFILE_PHOTOS_BUCKET = "profile_photos"

/**
 * Avatars are served through signed URLs from a private bucket. A fresh signature
 * on every render changes the URL, so browsers and the Supabase CDN never reuse a
 * download — that alone burned ~800 MB/day of egress. Instead, each path's URL is
 * signed for 30 days and memoised for 7, so every viewer gets the same URL for a
 * week and each browser fetches a given avatar about once a week.
 */
const SIGNED_URL_TTL_SECONDS = 30 * 24 * 3600
const SIGNED_URL_CACHE_SECONDS = 7 * 24 * 3600

/**
 * Object paths are versioned (one file per upload) so the stored bytes behind a
 * path never change — which is what makes the long cache lifetime safe.
 */
export const AVATAR_CACHE_CONTROL_SECONDS = "31536000"
/** Largest on-screen avatar is 64px (profile hero); 256px covers 3x displays. */
export const AVATAR_SIZE_PX = 256
/**
 * The /birthday showcase runs on the conference-room TV, where one photo can fill
 * a portrait card ~80vh tall (≈1,730 device px on 4K). Each upload therefore also
 * keeps an uncropped copy bounded at this many px on its long edge.
 */
export const AVATAR_LARGE_MAX_PX = 2048

export type AvatarSize = "thumb" | "large"

export function buildAvatarStoragePath(userId: string): string {
  return `${userId}/avatar-${Date.now()}.webp`
}

/**
 * The large copy sits beside the thumbnail as `avatar-<ts>-large.webp`. Legacy
 * paths (an unprocessed original) have no separate copy — the original is large.
 */
export function largeAvatarPath(avatarPath: string): string {
  return /\/avatar-\d+\.webp$/.test(avatarPath) ? avatarPath.replace(/\.webp$/, "-large.webp") : avatarPath
}

/** Every stored object behind one avatar_path, for deletes. */
export function avatarObjectPaths(avatarPath: string): string[] {
  return Array.from(new Set([avatarPath, largeAvatarPath(avatarPath)]))
}

function getSigningClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const getCachedSignedUrl = unstable_cache(
  async (avatarPath: string): Promise<string | null> => {
    const client = getSigningClient()
    if (!client) return null
    const { data } = await client.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .createSignedUrl(avatarPath, SIGNED_URL_TTL_SECONDS)
    return data?.signedUrl ?? null
  },
  ["profile-photo-signed-url"],
  { revalidate: SIGNED_URL_CACHE_SECONDS }
)

/** Signed URL for a single avatar path. Returns null if the path is missing or signing fails. */
export async function getAvatarSignedUrl(
  dataClient: SupabaseClient,
  avatarPath: string | null | undefined
): Promise<string | null> {
  if (!avatarPath) return null
  // Without the service role there is nothing request-independent to sign with,
  // so fall back to signing per request with the caller's client.
  if (!getSigningClient()) {
    const { data } = await dataClient.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .createSignedUrl(avatarPath, SIGNED_URL_TTL_SECONDS)
    return data?.signedUrl ?? null
  }
  return getCachedSignedUrl(avatarPath)
}

/**
 * Batch signed URLs for multiple avatar paths — use this instead of calling
 * getAvatarSignedUrl in a loop (e.g. the birthday page, directory listings).
 * Returns a map of avatarPath -> signedUrl; missing/failed paths are omitted.
 * `size: "large"` is for full-card displays only (the birthday showcase) and
 * falls back to the thumbnail if a large copy is missing.
 */
export async function getAvatarSignedUrls(
  dataClient: SupabaseClient,
  avatarPaths: string[],
  size: AvatarSize = "thumb"
): Promise<Map<string, string>> {
  const uniquePaths = Array.from(new Set(avatarPaths.filter(Boolean)))
  const entries = await Promise.all(
    uniquePaths.map(async (path) => {
      const signed =
        (size === "large" ? await getAvatarSignedUrl(dataClient, largeAvatarPath(path)) : null) ??
        (await getAvatarSignedUrl(dataClient, path))
      return [path, signed] as const
    })
  )

  const map = new Map<string, string>()
  for (const [path, signedUrl] of entries) {
    if (signedUrl) map.set(path, signedUrl)
  }
  return map
}
