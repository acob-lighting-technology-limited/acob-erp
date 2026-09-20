import type { NavBranch, RouteAliases } from "./types"

/**
 * How strongly `pathname` matches `targetHref`. Longer is more specific, and an
 * exact match beats any prefix match by a wide margin so a dashboard at the root
 * of a section never outranks the page actually being viewed.
 *
 * Returns 0 for no match.
 */
export function getRouteMatchLength(
  targetHref: string,
  pathname: string,
  aliases: RouteAliases = {},
  isExactOnly?: (href: string) => boolean
): number {
  // Section roots ("/admin", "/dept/x", "/profile") are prefixes of everything
  // below them, so they only ever match exactly.
  if (isExactOnly?.(targetHref)) {
    return pathname === targetHref ? targetHref.length + 1000 : 0
  }
  if (pathname === targetHref) return targetHref.length + 1000
  if (pathname.startsWith(`${targetHref}/`)) return targetHref.length

  for (const alias of aliases[targetHref] || []) {
    if (pathname === alias) return alias.length + 1000
    if (pathname.startsWith(`${alias}/`)) return alias.length
  }
  return 0
}

/** The best match anywhere in a branch — the node itself, a child or a grandchild. */
export function getItemMatchScore(
  item: NavBranch,
  pathname: string,
  aliases: RouteAliases = {},
  isExactOnly?: (href: string) => boolean
): number {
  let best = getRouteMatchLength(item.href, pathname, aliases, isExactOnly)
  for (const child of item.children || []) {
    best = Math.max(best, getRouteMatchLength(child.href, pathname, aliases, isExactOnly))
    for (const grandchild of child.children || []) {
      best = Math.max(best, getRouteMatchLength(grandchild.href, pathname, aliases, isExactOnly))
    }
  }
  return best
}

/**
 * The href of the single branch that best matches `pathname`, or null when none
 * does. Using one winner keeps two items from highlighting at once when one
 * href is a prefix of another.
 */
export function findActiveBranchHref<T extends NavBranch>(
  items: T[],
  pathname: string | null,
  aliases: RouteAliases = {},
  isExactOnly?: (href: string) => boolean
): string | null {
  if (!pathname) return null

  let bestHref: string | null = null
  let bestScore = 0

  for (const item of items) {
    const score = getItemMatchScore(item, pathname, aliases, isExactOnly)
    if (score > bestScore) {
      bestScore = score
      bestHref = item.href
    }
  }

  return bestHref
}
