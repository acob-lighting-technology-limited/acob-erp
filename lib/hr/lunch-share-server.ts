import "server-only"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { loadMenuForDate } from "@/lib/hr/lunch-menu-server"
import { isVotingOpen, loadLunchSettings, resolveVotingDeadline } from "@/lib/hr/lunch-voting"
import { isLunchShareDate } from "@/lib/hr/lunch-share"

export interface LunchSharePreview {
  date: string
  /** "Thursday, 2 October" */
  dayLabel: string
  groups: { name: string | null; dishes: string[] }[]
  deadline: string
  votingOpen: boolean
}

/**
 * What the public /lunch/[date] share page may show an anonymous visitor:
 * the dishes and the deadline of a published, non-cancelled menu. Votes,
 * voter names and pricing stay behind login. Drafts and cancelled days
 * resolve to null so an unpublished menu never leaks through a guessed URL.
 *
 * Wrapped in cache() so generateMetadata and the page share one load.
 */
export const loadLunchSharePreview = cache(async (date: string): Promise<LunchSharePreview | null> => {
  if (!isLunchShareDate(date)) return null

  const client = getServiceRoleClientOrFallback(await createClient())
  const menu = await loadMenuForDate(client, date)
  if (!menu) return null

  const settings = await loadLunchSettings(client)
  const groups = menu.groups
    .map((group) => ({
      name: group.name,
      dishes: group.options.filter((option) => option.is_available).map((option) => option.name),
    }))
    .filter((group) => group.dishes.length > 0)

  return {
    date,
    dayLabel: new Date(`${date}T12:00:00+01:00`).toLocaleDateString("en-GB", {
      timeZone: "Africa/Lagos",
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    groups,
    deadline: resolveVotingDeadline(menu, settings).toISOString(),
    votingOpen: isVotingOpen(menu, settings),
  }
})
