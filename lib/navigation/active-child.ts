/** True when `pathname` is `href` or a page beneath it. */
export function pathMatches(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false
  return pathname === href || pathname.startsWith(href + "/")
}

/**
 * True when `href` is the sidebar child to highlight for `pathname`. A child
 * nested under a sibling's URL (Sites at /portfolios/sites, beside Portfolios
 * at /portfolios) would otherwise light up both, so the longest matching
 * sibling wins.
 */
export function isActiveChild(
  pathname: string | null | undefined,
  href: string,
  siblings: ReadonlyArray<{ href: string }>
): boolean {
  if (!pathMatches(pathname, href)) return false
  return !siblings.some((sibling) => sibling.href.length > href.length && pathMatches(pathname, sibling.href))
}
