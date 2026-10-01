/**
 * The link HR posts to the staff WhatsApp group for a day's lunch poll.
 *
 * WhatsApp builds its link preview by fetching the URL as an anonymous
 * visitor, so the bare /lunch link only ever previewed the login page. Each
 * day instead gets a public /lunch/YYYY-MM-DD page whose metadata and
 * generated image carry that day's dishes. The date is part of the URL because
 * WhatsApp caches a preview per URL — one shared link would keep showing the
 * first menu it saw.
 *
 * Client-safe: the admin "Copy WhatsApp message" action uses this too.
 */

import { toLocalISODate } from "@/lib/utils/date"

export const LUNCH_SHARE_PATH_PATTERN = /^\/lunch\/\d{4}-\d{2}-\d{2}(\/|$)/

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isLunchShareDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const parsed = new Date(`${value}T12:00:00+01:00`)
  return !Number.isNaN(parsed.getTime()) && toLocalISODate(parsed) === value
}

export function lunchSharePath(date: string): string {
  return `/lunch/${date}`
}

function shiftISODate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00+01:00`)
  d.setUTCDate(d.getUTCDate() + days)
  return toLocalISODate(d)
}

/** "Today's", "Tomorrow's", or the weekday ("Friday's") for anything further out. */
function dayPossessive(date: string, today: string): string {
  if (date === today) return "Today's"
  if (date === shiftISODate(today, 1)) return "Tomorrow's"
  const weekday = new Date(`${date}T12:00:00+01:00`).toLocaleDateString("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "long",
  })
  return `${weekday}'s`
}

function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }).format(now)
  )
  if (hour < 12) return "Good morning, everyone."
  if (hour < 17) return "Good afternoon, everyone."
  return "Good evening, everyone."
}

/** "7:00 AM on Friday, 3 October" — the deadline as staff read it. */
export function formatLunchDeadline(deadline: string | Date): string {
  const d = new Date(deadline)
  const time = d.toLocaleTimeString("en-US", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit" })
  const day = d.toLocaleDateString("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  return `${time} on ${day}`
}

export function buildLunchWhatsAppMessage(input: {
  date: string
  today: string
  deadline: string
  origin: string
  now?: Date
}): string {
  const url = `${input.origin}${lunchSharePath(input.date)}`
  return [
    greeting(input.now ?? new Date()),
    "",
    `${dayPossessive(input.date, input.today)} lunch menu has been posted on Matrix. Kindly vote before ${formatLunchDeadline(input.deadline)}.`,
    "Please find the quick-access link below:",
    "",
    url,
  ].join("\n")
}
