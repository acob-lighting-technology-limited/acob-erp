import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

export const PIN_LENGTH = 6
export const MAX_PIN_ATTEMPTS = 5
export const PIN_LOCK_MINUTES = 15
export const RESET_CODE_TTL_MINUTES = 10
export const MAX_RESET_CODE_ATTEMPTS = 5

const KEY_LENGTH = 32

/** Why this PIN is not acceptable, or null when it is. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return `Your PIN must be exactly ${PIN_LENGTH} digits.`
  if (/^(\d)\1{5}$/.test(pin)) return "Avoid a PIN of one repeated digit."
  const digits = pin.split("").map(Number)
  const ascending = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 1) % 10)
  const descending = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 9) % 10)
  if (ascending || descending) return "Avoid a sequence like 123456."
  return null
}

/** Salted scrypt hash, stored as `scrypt$<salt b64>$<hash b64>`. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(secret, salt, KEY_LENGTH)
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`
}

export async function verifySecret(secret: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false
  const [scheme, saltB64, hashB64] = stored.split("$")
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, "base64")
  const actual = await scrypt(secret, Buffer.from(saltB64, "base64"), expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** A 6-digit emailed reset code. */
export function generateResetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

export function isLocked(lockedUntil: string | null | undefined, now = new Date()): boolean {
  return Boolean(lockedUntil && new Date(lockedUntil).getTime() > now.getTime())
}
