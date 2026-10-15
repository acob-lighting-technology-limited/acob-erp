import "server-only"
import { logger } from "@/lib/logger"

const log = logger("cpanel-client")

/** cPanel answers in well under a second; anything slower is a hung connection. */
const REQUEST_TIMEOUT_MS = 15_000

/**
 * Staff mailboxes (@org.acoblighting.com) are hosted on cPanel, reached through
 * its UAPI with an API token. The token can manage the whole hosting account —
 * files, DNS, databases — so it lives only in server env and never reaches the
 * browser.
 */
interface CpanelConfig {
  host: string
  user: string
  token: string
}

function readConfig(): CpanelConfig | null {
  const host = process.env.CPANEL_HOST?.trim()
  const user = process.env.CPANEL_USER?.trim()
  const token = process.env.CPANEL_API_TOKEN?.trim()
  if (!host || !user || !token) return null
  return { host, user, token }
}

export function isCpanelConfigured(): boolean {
  return readConfig() !== null
}

export class CpanelError extends Error {
  constructor(
    message: string,
    readonly fn: string
  ) {
    super(message)
    this.name = "CpanelError"
  }
}

interface UapiEnvelope<T> {
  status: number
  data: T
  errors: string[] | null
}

async function uapi<T>(fn: string, params: Record<string, string | number> = {}): Promise<T> {
  const config = readConfig()
  if (!config) throw new CpanelError("cPanel is not configured (CPANEL_HOST / CPANEL_USER / CPANEL_API_TOKEN)", fn)

  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const url = `https://${config.host}:2083/execute/${fn}${query.size > 0 ? `?${query}` : ""}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `cpanel ${config.user}:${config.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    log.error({ fn, err: String(err) }, "cPanel request failed")
    throw new CpanelError("Could not reach cPanel", fn)
  }

  if (!res.ok) {
    log.error({ fn, status: res.status }, "cPanel returned an HTTP error")
    throw new CpanelError(
      res.status === 401 || res.status === 403 ? "cPanel rejected the API token" : `cPanel error ${res.status}`,
      fn
    )
  }

  const body = (await res.json().catch(() => null)) as UapiEnvelope<T> | null
  if (!body || body.status !== 1) {
    const reason = body?.errors?.join("; ") || "Unexpected cPanel response"
    log.error({ fn, reason }, "cPanel call failed")
    throw new CpanelError(reason, fn)
  }
  return body.data
}

// ---------------------------------------------------------------------------
// Mailboxes
// ---------------------------------------------------------------------------

export interface CpanelMailbox {
  email: string
  user: string
  domain: string
  usedBytes: number
  /** null = unlimited */
  quotaBytes: number | null
  /** 0–100, null when the quota is unlimited */
  usedPercent: number | null
  suspendedLogin: boolean
  suspendedIncoming: boolean
}

interface RawMailbox {
  email: string
  user: string
  domain: string
  _diskused: string | number
  _diskquota: string | number
  suspended_login: number | string
  suspended_incoming: number | string
}

function toBytes(value: string | number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function normalizeMailbox(raw: RawMailbox): CpanelMailbox {
  const usedBytes = toBytes(raw._diskused)
  const quota = toBytes(raw._diskquota)
  const quotaBytes = quota > 0 ? quota : null
  return {
    email: raw.email.toLowerCase(),
    user: raw.user,
    domain: raw.domain.toLowerCase(),
    usedBytes,
    quotaBytes,
    usedPercent: quotaBytes ? Math.min(100, Math.round((usedBytes / quotaBytes) * 1000) / 10) : null,
    suspendedLogin: Number(raw.suspended_login) === 1,
    suspendedIncoming: Number(raw.suspended_incoming) === 1,
  }
}

function splitAddress(email: string): { user: string; domain: string } {
  const [user, domain] = email.trim().toLowerCase().split("@")
  if (!user || !domain) throw new CpanelError(`Not an email address: ${email}`, "Email")
  return { user, domain }
}

/** Every mailbox on the account, with usage and quota. */
export async function listMailboxes(): Promise<CpanelMailbox[]> {
  const rows = await uapi<RawMailbox[]>("Email/list_pops_with_disk")
  return rows.map(normalizeMailbox)
}

/** One mailbox, or null when it does not exist on cPanel. */
export async function getMailbox(email: string): Promise<CpanelMailbox | null> {
  const { user, domain } = splitAddress(email)
  const rows = await uapi<RawMailbox[]>("Email/list_pops_with_disk", { email: user, domain })
  const match = rows.find((r) => r.user.toLowerCase() === user && r.domain.toLowerCase() === domain)
  return match ? normalizeMailbox(match) : null
}

/** Sets a mailbox quota in megabytes. */
export async function setMailboxQuota(email: string, quotaMb: number): Promise<void> {
  if (!Number.isInteger(quotaMb) || quotaMb <= 0)
    throw new CpanelError("Quota must be a positive whole number", "Email")
  const { user, domain } = splitAddress(email)
  await uapi("Email/edit_pop_quota", { email: user, domain, quota: quotaMb })
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export interface CpanelAccountUsage {
  megabytesUsed: number
  /** null = unlimited */
  megabyteLimit: number | null
  inodesUsed: number
  /** null = unlimited */
  inodeLimit: number | null
}

interface RawQuotaInfo {
  megabytes_used: string | number
  megabyte_limit: string | number
  inodes_used: string | number
  inode_limit: string | number
}

/**
 * Whole-account usage. Disk is unlimited on the current plan; the inode cap is
 * the real ceiling — every stored email is a file, and at the cap the account
 * stops accepting mail for everyone.
 */
export async function getAccountUsage(): Promise<CpanelAccountUsage> {
  const raw = await uapi<RawQuotaInfo>("Quota/get_quota_info")
  const mbLimit = Number(raw.megabyte_limit)
  const inodeLimit = Number(raw.inode_limit)
  return {
    megabytesUsed: Number(raw.megabytes_used) || 0,
    megabyteLimit: mbLimit > 0 ? mbLimit : null,
    inodesUsed: Number(raw.inodes_used) || 0,
    inodeLimit: inodeLimit > 0 ? inodeLimit : null,
  }
}
