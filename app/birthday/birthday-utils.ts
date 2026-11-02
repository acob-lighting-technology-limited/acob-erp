import { apiFetch } from "@/lib/api-client"

export type Mode = "day" | "week" | "month" | "range"

export interface Celebrant {
  firstName: string
  lastName: string
  department: string
  /** MM-DD */
  birthday: string
  avatarUrl: string | null
}

/** The "Coming up" summary shown bottom right of the spotlight. */
export interface UpcomingBirthdays {
  /** e.g. "Nov 2 – Nov 8" */
  label: string
  celebrants: Celebrant[]
}

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export const WEEK_OPTIONS = Array.from({ length: 53 }, (_, i) => i + 1)

export function toMMDD(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** The seven days after `endDate` — the "Coming up" week after a spotlight period. */
export function nextWeekAfter(endDate: Date): { start: string; end: string; label: string } {
  const start = toMMDD(addDays(endDate, 1))
  const end = toMMDD(addDays(endDate, 7))
  return { start, end, label: `${formatMMDDLabel(start)} – ${formatMMDDLabel(end)}` }
}

/** Active staff with a birthday between two MM-DD dates (inclusive, wraps over New Year). */
export async function fetchCelebrants(start: string, end: string, photo: "large" | "thumb"): Promise<Celebrant[]> {
  const response = await apiFetch(`/api/admin/hr/birthdays?start=${start}&end=${end}&photo=${photo}`)
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || "Failed to load birthdays")
  return (payload?.data as Celebrant[]) || []
}

/**
 * Celebrants for the agenda deck's birthday slide, which any staff member may
 * export: first name, day/month and photo only, at most a week at a time.
 */
export async function fetchMeetingCelebrants(
  start: string,
  end: string,
  photo: "large" | "thumb"
): Promise<Celebrant[]> {
  const response = await apiFetch(`/api/reports/meeting-birthdays?start=${start}&end=${end}&photo=${photo}`)
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || "Failed to load birthdays")
  const rows = (payload?.data as Array<Pick<Celebrant, "firstName" | "birthday" | "avatarUrl">>) || []
  return rows.map((row) => ({ ...row, lastName: "", department: "" }))
}

export function formatMMDDLabel(mmdd: string): string {
  const [month, day] = mmdd.split("-").map(Number)
  return `${MONTHS[month - 1]?.slice(0, 3) ?? "?"} ${day}`
}

export function displayName(firstName: string): string {
  const lower = firstName.trim().toLowerCase()
  return lower === "eliah" ? "Elijah" : firstName
}

export function formatNamesList(names: string[]): string {
  if (names.length === 0) return ""
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`
}

export function isBirthdayToday(celebrant: Celebrant): boolean {
  return celebrant.birthday === toMMDD(new Date())
}
