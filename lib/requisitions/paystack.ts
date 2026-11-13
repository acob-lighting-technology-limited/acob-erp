import "server-only"
import { logger } from "@/lib/logger"
import { nubanCodesForBankCode, NIGERIAN_BANKS, type NigerianBank } from "./nuban"

/**
 * Paystack's bank list and account name check (NIBSS name enquiry), used to
 * confirm who a requisition pays before anyone signs it. Server only: the
 * secret key never reaches the browser. A lookup reads a name; it moves no money.
 *
 * Docs: https://paystack.com/docs/api/verification/ and /docs/api/miscellaneous/
 */

const log = logger("requisitions-paystack")
const API = "https://api.paystack.co"
const TIMEOUT_MS = 8000
const BANKS_CACHE_SECONDS = 60 * 60 * 24

function secretKey() {
  return process.env.PAYSTACK_SECRET_KEY || null
}

export function isPaystackConfigured() {
  return Boolean(secretKey())
}

/** `revalidate: 0` skips the cache, so a failed lookup is never served again. */
async function paystackGet(path: string, revalidate: number) {
  const key = secretKey()
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set")
  return fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...(revalidate > 0 ? { next: { revalidate } } : { cache: "no-store" as const }),
  })
}

interface PaystackBankRow {
  name: string
  code: string
  active: boolean
  is_deleted?: boolean | null
  currency?: string
}

/**
 * Nigerian banks with Paystack's codes. Falls back to the built-in list when
 * Paystack is not configured or not reachable, so the form always has banks.
 */
export async function listBanks(): Promise<NigerianBank[]> {
  if (!isPaystackConfigured()) return [...NIGERIAN_BANKS]
  try {
    const rows: PaystackBankRow[] = []
    let cursor: string | null = null
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({ country: "nigeria", currency: "NGN", use_cursor: "true", perPage: "100" })
      if (cursor) query.set("next", cursor)
      const res = await paystackGet(`/bank?${query}`, BANKS_CACHE_SECONDS)
      const body = (await res.json().catch(() => null)) as {
        status?: boolean
        data?: PaystackBankRow[]
        meta?: { next?: string | null }
      } | null
      if (!res.ok || !body?.status || !Array.isArray(body.data)) throw new Error(`List Banks failed (${res.status})`)
      rows.push(...body.data)
      cursor = body.meta?.next || null
      if (!cursor) break
    }

    // Our own table knows which banks follow the NUBAN check digit.
    const checked = new Map(NIGERIAN_BANKS.map((b) => [b.code, b.nuban]))
    const seen = new Set<string>()
    const banks: NigerianBank[] = []
    for (const row of rows) {
      if (!row.active || row.is_deleted || !row.code || seen.has(row.code)) continue
      seen.add(row.code)
      banks.push({
        name: row.name.trim(),
        code: row.code,
        nuban: nubanCodesForBankCode(row.code).some((code) => checked.get(code) ?? false),
      })
    }
    return banks.length ? banks.sort((a, b) => a.name.localeCompare(b.name)) : [...NIGERIAN_BANKS]
  } catch (err) {
    log.warn({ err: String(err) }, "Paystack bank list unavailable; using the built-in list")
    return [...NIGERIAN_BANKS]
  }
}

export type AccountNameResult =
  | { status: "found"; accountName: string; bankCode: string }
  /** The bank says there is no such account (or the number and bank do not match). */
  | { status: "not_found" }
  /** Paystack is not set up, down, or timed out: nothing is known either way. */
  | { status: "unavailable" }

type AccountNameLookupResult =
  | { status: "found"; accountName: string }
  | { status: "not_found" }
  | { status: "unavailable" }

export async function resolveAccountName(accountNumber: string, bankCode: string): Promise<AccountNameResult> {
  if (!/^\d{10}$/.test(accountNumber) || !/^\d{3,6}$/.test(bankCode)) return { status: "not_found" }
  if (!isPaystackConfigured()) return { status: "unavailable" }
  let unavailable = false
  for (const code of nubanCodesForBankCode(bankCode)) {
    const result = await resolveAccountNameForCode(accountNumber, code)
    if (result.status === "found") return { ...result, bankCode: code }
    if (result.status === "unavailable") unavailable = true
  }
  return unavailable ? { status: "unavailable" } : { status: "not_found" }
}

async function resolveAccountNameForCode(accountNumber: string, bankCode: string): Promise<AccountNameLookupResult> {
  try {
    const query = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode })
    // Not cached: a "not found" while a bank's link is down must not stick.
    const res = await paystackGet(`/bank/resolve?${query}`, 0)
    const body = (await res.json().catch(() => null)) as {
      status?: boolean
      message?: string
      data?: { account_name?: string }
    } | null
    const name = body?.data?.account_name?.trim()
    if (res.ok && body?.status && name) return { status: "found", accountName: name }
    // 400/422: "Could not resolve account name". Anything else is Paystack's problem, not the number's.
    if (res.status === 400 || res.status === 422) return { status: "not_found" }
    if (res.status === 401 || res.status === 403) {
      // Our setup, not the bank: a wrong or revoked PAYSTACK_SECRET_KEY, or an IP not allowed.
      log.error({ status: res.status, message: body?.message }, "Paystack rejected PAYSTACK_SECRET_KEY")
    } else {
      log.warn({ status: res.status, message: body?.message }, "Paystack resolve failed")
    }
    return { status: "unavailable" }
  } catch (err) {
    log.warn({ err: String(err) }, "Paystack resolve unreachable")
    return { status: "unavailable" }
  }
}

/**
 * Ask the bank for every beneficiary that has a bank code, and record the name
 * it returns. A number the bank says does not exist is refused; when Paystack
 * cannot be reached the beneficiary is kept, unconfirmed.
 */
export async function confirmBeneficiaries<T extends { account_number: string; bank_name: string; bank_code?: string }>(
  beneficiaries: T[]
): Promise<
  { ok: true; beneficiaries: (T & { verified_account_name: string | null })[] } | { ok: false; message: string }
> {
  const results = await Promise.all(
    beneficiaries.map((b) => (b.bank_code ? resolveAccountName(b.account_number, b.bank_code) : Promise.resolve(null)))
  )
  const missing = results.findIndex((r) => r?.status === "not_found")
  if (missing >= 0) {
    const b = beneficiaries[missing]
    return {
      ok: false,
      message: `Beneficiary ${missing + 1}: ${b.bank_name} has no account ${b.account_number}. Check the number and the bank.`,
    }
  }
  return {
    ok: true,
    beneficiaries: beneficiaries.map((b, i) => {
      const r = results[i]
      return {
        ...b,
        ...(r?.status === "found" ? { bank_code: r.bankCode } : {}),
        verified_account_name: r?.status === "found" ? r.accountName : null,
      }
    }),
  }
}
