export type Mode = "day" | "week" | "month" | "range"

export interface Celebrant {
  firstName: string
  lastName: string
  department: string
  /** MM-DD */
  birthday: string
  avatarUrl: string | null
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
