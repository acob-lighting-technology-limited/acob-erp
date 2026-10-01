import "server-only"
import { randomUUID } from "crypto"
import { getOneDriveService } from "@/lib/onedrive/onedrive"
import { toLocalISODate, toLocalTimeString } from "@/lib/utils/date"

/**
 * Network activity logs are archived to SharePoint, not the database.
 *
 * They are written constantly and read only when an incident is investigated,
 * so keeping them in Postgres cost ~120 MB of database and ~18% of log ingest
 * for a 7-day window. Each router batch is now written as one CSV file under a
 * WAT day folder, kept for NETWORK_LOG_RETENTION_MONTHS, and combined back into
 * a single CSV per day on download.
 *
 *   it-communications / IT / Network Logs / 2026 / 10 / 01 / 09-05-00-1a2b3c4d.csv
 */
export const NETWORK_LOG_ROOT = "/it-communications/IT/Network Logs"
export const NETWORK_LOG_RETENTION_MONTHS = 12

export const NETWORK_LOG_COLUMNS = [
  "visited_at",
  "matched_identifier",
  "domain",
  "raw_url",
  "source_ip",
  "device_hostname",
  "mac_address",
  "device_vendor",
  "user_agent",
] as const

export type NetworkLogRow = Record<(typeof NETWORK_LOG_COLUMNS)[number], string | null>

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Quote a CSV cell. These files are opened in Excel and the values (domains,
 * hostnames) come off the network, so a leading = + - @ is neutralised to stop
 * them being evaluated as formulas.
 */
export function toCsvCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return ""
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsvLine(values: (string | null | undefined)[]): string {
  return values.map(toCsvCell).join(",")
}

export function buildBatchCsv(rows: NetworkLogRow[]): string {
  const lines = [NETWORK_LOG_COLUMNS.join(",")]
  for (const row of rows) lines.push(toCsvLine(NETWORK_LOG_COLUMNS.map((column) => row[column])))
  return `${lines.join("\r\n")}\r\n`
}

export function dayFolderPath(date: string): string {
  const match = DATE_RE.exec(date)
  if (!match) throw new Error(`Invalid archive date: ${date}`)
  const [, year, month, day] = match
  return `${NETWORK_LOG_ROOT}/${year}/${month}/${day}`
}

/** One file per batch; the random suffix keeps two batches in the same second apart. */
export function batchFilePath(receivedAt: Date = new Date()): string {
  const time = toLocalTimeString(receivedAt).replace(/:/g, "-")
  return `${dayFolderPath(toLocalISODate(receivedAt))}/${time}-${randomUUID().slice(0, 8)}.csv`
}

export async function uploadBatch(rows: NetworkLogRow[], receivedAt: Date = new Date()): Promise<string> {
  const path = batchFilePath(receivedAt)
  await getOneDriveService().uploadFile(path, new TextEncoder().encode(buildBatchCsv(rows)), "text/csv")
  return path
}

export interface ArchivedDay {
  date: string
  files: number
  bytes: number
  webUrl: string
}

function isGraphNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.includes("(404)")
}

async function listFoldersOrEmpty(path: string) {
  try {
    return (await getOneDriveService().listFolder(path)).filter((item) => item.isFolder)
  } catch (error) {
    if (isGraphNotFound(error)) return []
    throw error
  }
}

/** Every archived day, newest first. Costs one Graph call per year plus one per month. */
export async function listArchivedDays(): Promise<ArchivedDay[]> {
  const years = await listFoldersOrEmpty(NETWORK_LOG_ROOT)
  const months = (
    await Promise.all(years.map(async (year) => (await listFoldersOrEmpty(year.path)).map((m) => ({ year, m }))))
  ).flat()
  const days = (
    await Promise.all(
      months.map(async ({ year, m }) =>
        (await listFoldersOrEmpty(m.path)).map(
          (d): ArchivedDay => ({
            date: `${year.name}-${m.name}-${d.name}`,
            files: d.childCount ?? 0,
            bytes: d.size,
            webUrl: d.webUrl,
          })
        )
      )
    )
  ).flat()
  return days.filter((d) => DATE_RE.test(d.date)).sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Concatenate a day's batch files into one CSV, adding the staff member's name
 * (resolved at download time so ingest never touches the database).
 */
export async function buildDayCsv(date: string, staffNameByEmail: Map<string, string>): Promise<string | null> {
  const onedrive = getOneDriveService()
  let files
  try {
    files = (await onedrive.listFolder(dayFolderPath(date))).filter((item) => !item.isFolder)
  } catch (error) {
    if (isGraphNotFound(error)) return null
    throw error
  }
  files.sort((a, b) => a.name.localeCompare(b.name))

  const bodies: string[] = new Array(files.length)
  const CONCURRENCY = 8
  for (let start = 0; start < files.length; start += CONCURRENCY) {
    await Promise.all(
      files.slice(start, start + CONCURRENCY).map(async (file, offset) => {
        const url = file.downloadUrl ?? (await onedrive.getDownloadUrl(file.path))
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to download ${file.name} (${response.status})`)
        bodies[start + offset] = await response.text()
      })
    )
  }

  const identifierIndex = NETWORK_LOG_COLUMNS.indexOf("matched_identifier")
  const lines = [["staff_name", ...NETWORK_LOG_COLUMNS].join(",")]
  for (const body of bodies) {
    const [, ...rows] = body.split(/\r?\n/)
    for (const line of rows) {
      if (!line) continue
      // The identifier is a plain email in practice; a quoted cell just won't match a name.
      const identifier = line.split(",")[identifierIndex]?.trim().toLowerCase() ?? ""
      lines.push(`${toCsvCell(staffNameByEmail.get(identifier) ?? "")},${line}`)
    }
  }
  return `${lines.join("\r\n")}\r\n`
}

/**
 * Delete whole month folders that fall entirely outside the retention window,
 * then any year folder left empty. Deleted folders go to the SharePoint recycle
 * bin. Returns the month paths removed.
 */
export async function purgeExpiredMonths(now: Date = new Date()): Promise<string[]> {
  const [year, month] = toLocalISODate(now).split("-").map(Number)
  const cutoffIndex = year * 12 + (month - 1) - NETWORK_LOG_RETENTION_MONTHS

  const onedrive = getOneDriveService()
  const removed: string[] = []
  for (const yearFolder of await listFoldersOrEmpty(NETWORK_LOG_ROOT)) {
    const months = await listFoldersOrEmpty(yearFolder.path)
    let kept = 0
    for (const monthFolder of months) {
      const index = Number(yearFolder.name) * 12 + (Number(monthFolder.name) - 1)
      if (Number.isFinite(index) && index < cutoffIndex) {
        await onedrive.deleteItem(monthFolder.path)
        removed.push(monthFolder.path)
      } else {
        kept += 1
      }
    }
    if (kept === 0 && months.length > 0) await onedrive.deleteItem(yearFolder.path)
  }
  return removed
}
