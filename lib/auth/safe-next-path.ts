/**
 * The post-login destination, taken from a `next` query parameter, reduced to a
 * same-origin path or the fallback.
 *
 * String checks ("starts with /", "no //") are not enough: the WHATWG URL parser
 * that browsers and `new URL()` use treats `\` as `/` and drops tabs and newlines
 * anywhere in the input, so `/\evil.com` and `/<tab>/evil.com` both resolve to
 * `//evil.com`. This resolves the value against a throwaway origin and accepts it
 * only if it is still on that origin, then returns the *parsed* path so what is
 * redirected to is exactly what was checked.
 */
const PLACEHOLDER_ORIGIN = "https://matrix.invalid"

export function getSafeNextPath(next: string | null | undefined, fallback = "/profile"): string {
  if (!next || typeof next !== "string" || next.length > 2048) return fallback
  if (!next.startsWith("/") || next.startsWith("//")) return fallback
  // Any control character (tab, CR, LF, NUL…) or backslash is rejected outright
  // rather than normalised: no legitimate in-app path contains one.
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback

  let url: URL
  try {
    url = new URL(next, PLACEHOLDER_ORIGIN)
  } catch {
    return fallback
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback

  return `${url.pathname}${url.search}${url.hash}`
}
