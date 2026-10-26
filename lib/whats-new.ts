/**
 * Staff-facing "what's new" heads-ups. Each entry is shown once, in a popup on
 * the first page load after it ships, then never again on that device.
 *
 * To announce a change, add an entry at the TOP with a new, never-reused id.
 * Keep it to what staff will notice and what they can now do — not how it was
 * built. Entries older than WHATS_NEW_WINDOW_DAYS stop showing on their own,
 * so someone who joins months later isn't greeted with stale news.
 */

export interface Announcement {
  /** Stable key recorded once seen. Never change or reuse one. */
  id: string
  /** YYYY-MM-DD the change went live. */
  date: string
  title: string
  body: string
  /** Where to try it. */
  href?: string
  cta?: string
}

export const WHATS_NEW_WINDOW_DAYS = 30

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "2026-10-lunch-hide-name",
    date: "2026-10-26",
    title: "Vote for lunch privately",
    body: "You can now hide your name on the lunch poll. Turn on “Hide my name from colleagues” and your vote still counts, but shows as private to everyone else. Admin & HR can still see it.",
    href: "/hr/lunch",
    cta: "Open Lunch",
  },
]

/** Announcements still inside the window, newest first. */
export function activeAnnouncements(now: Date = new Date()): Announcement[] {
  const cutoff = now.getTime() - WHATS_NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return ANNOUNCEMENTS.filter((a) => new Date(`${a.date}T00:00:00+01:00`).getTime() >= cutoff).sort((a, b) =>
    b.date.localeCompare(a.date)
  )
}
