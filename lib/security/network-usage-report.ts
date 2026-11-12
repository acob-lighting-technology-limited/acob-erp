/**
 * Turns stored daily usage rows into the figures the Data usage tab shows.
 * Download is the router's `bytes_out` (and the WAN port's `rx`); upload is `bytes_in`.
 */

export interface UsageDailyRow {
  day: string
  username: string
  mac_address: string
  bytes_in: number
  bytes_out: number
}

export interface UsageWanRow {
  day: string
  rx_bytes: number
  tx_bytes: number
}

export interface UsageUserSummary {
  username: string
  staffName: string | null
  devices: number
  downloadBytes: number
  uploadBytes: number
  totalBytes: number
  daysActive: number
}

export interface UsageDaySummary {
  day: string
  downloadBytes: number
  uploadBytes: number
  officeDownloadBytes: number
  officeUploadBytes: number
}

export interface UsageReport {
  users: UsageUserSummary[]
  days: UsageDaySummary[]
  totals: { downloadBytes: number; uploadBytes: number; officeDownloadBytes: number; officeUploadBytes: number }
}

export function summariseUsage(
  rows: UsageDailyRow[],
  wanRows: UsageWanRow[],
  staffNameByLogin: Map<string, string> = new Map()
): UsageReport {
  const users = new Map<string, { devices: Set<string>; days: Set<string>; down: number; up: number }>()
  const days = new Map<string, UsageDaySummary>()

  const dayFor = (day: string): UsageDaySummary => {
    let entry = days.get(day)
    if (!entry) {
      entry = { day, downloadBytes: 0, uploadBytes: 0, officeDownloadBytes: 0, officeUploadBytes: 0 }
      days.set(day, entry)
    }
    return entry
  }

  for (const row of rows) {
    const login = row.username.toLowerCase()
    const user = users.get(login) ?? { devices: new Set<string>(), days: new Set<string>(), down: 0, up: 0 }
    user.down += row.bytes_out
    user.up += row.bytes_in
    user.days.add(row.day)
    if (row.mac_address) user.devices.add(row.mac_address)
    users.set(login, user)

    const day = dayFor(row.day)
    day.downloadBytes += row.bytes_out
    day.uploadBytes += row.bytes_in
  }

  for (const row of wanRows) {
    const day = dayFor(row.day)
    day.officeDownloadBytes += row.rx_bytes
    day.officeUploadBytes += row.tx_bytes
  }

  const userList: UsageUserSummary[] = [...users.entries()]
    .map(([username, user]) => ({
      username,
      staffName: staffNameByLogin.get(username) ?? null,
      devices: Math.max(user.devices.size, 1),
      downloadBytes: user.down,
      uploadBytes: user.up,
      totalBytes: user.down + user.up,
      daysActive: user.days.size,
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes)

  const dayList = [...days.values()].sort((a, b) => b.day.localeCompare(a.day))
  const totals = dayList.reduce(
    (sum, day) => ({
      downloadBytes: sum.downloadBytes + day.downloadBytes,
      uploadBytes: sum.uploadBytes + day.uploadBytes,
      officeDownloadBytes: sum.officeDownloadBytes + day.officeDownloadBytes,
      officeUploadBytes: sum.officeUploadBytes + day.officeUploadBytes,
    }),
    { downloadBytes: 0, uploadBytes: 0, officeDownloadBytes: 0, officeUploadBytes: 0 }
  )

  return { users: userList, days: dayList, totals }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** `YYYY-MM-DD` from the UTC parts of a date that was built from a plain calendar day. */
function formatUtcDay(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${date.getUTCFullYear()}-${month}-${day}`
}

export function isIsoDay(value: string | null | undefined): value is string {
  if (!value || !DAY_RE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && formatUtcDay(parsed) === value
}

/** `YYYY-MM-DD` shifted by whole days, with no timezone surprises. */
export function shiftIsoDay(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return formatUtcDay(date)
}

/** Whole days from `from` to `to`, counting both ends. */
export function daysInRange(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
}
