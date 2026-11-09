/**
 * Extracts the department console the caller is sitting in, if any.
 *
 * Prefers the explicit x-dept-context header set by apiFetch(); falls back to
 * parsing the Referer, which the browser sends in full for same-origin requests
 * under our strict-origin-when-cross-origin policy. The fallback covers the
 * call sites that still use raw fetch() instead of apiFetch().
 *
 * The returned id is untrusted input — callers MUST re-resolve lead membership
 * against the database before granting anything on the strength of it.
 *
 * Pure (no server imports) so middleware can use it too.
 */
export function readDeptContextId(h: Headers): string | null {
  const explicit = h.get("x-dept-context")?.trim()
  if (explicit) return explicit

  // Referer on a *navigation* is the page you came FROM, not the page being
  // rendered — using it there would scope an /admin page to the dept console
  // you just navigated away from. Skip both full document loads and Next.js
  // client-side RSC navigations (which look like XHR but are navigations).
  // Only plain fetch/XHR remains, where Referer is the page making the call.
  if (h.get("sec-fetch-dest") === "document") return null
  if (h.get("rsc") === "1" || h.has("next-router-prefetch") || h.has("next-router-state-tree")) return null

  const referer = h.get("referer")
  if (!referer) return null
  try {
    const match = new URL(referer).pathname.match(/^\/dept\/([^/]+)/)
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}
