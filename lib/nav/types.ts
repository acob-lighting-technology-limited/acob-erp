/**
 * Shared shapes for the three sidebars (staff, admin, dept). They render the
 * same tree with different sources, so the node types and the active-route
 * matching live here rather than being copied into each component.
 */

export type NavSubChild = {
  name: string
  href: string
  /** Expansion or gloss for an abbreviated name, shown on hover. */
  description?: string
}

export type NavChild = {
  name: string
  href: string
  /** Expansion or gloss for an abbreviated name, shown on hover. */
  description?: string
  children?: NavSubChild[]
  /**
   * The viewer cannot open this branch's own page, so `href` was retargeted to
   * the first descendant they can reach. Consumers render such a row as a
   * toggle rather than a link — following it would land on a page whose name
   * does not match the label.
   */
  retargeted?: boolean
}

/** The minimum a node needs for route matching: its own href plus its subtree. */
export type NavBranch = {
  href: string
  children?: NavChild[]
}

/**
 * Extra pathnames that should count as a match for a given href — legacy routes
 * that redirect into it, or a feature surfaced under a different parent.
 */
export type RouteAliases = Record<string, string[]>
