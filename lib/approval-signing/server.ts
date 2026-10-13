import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { escapeHtml } from "@/lib/email-templates/utils"
import { logger } from "@/lib/logger"
import { sendNotificationEmailWithRetry } from "@/lib/notifications/email-gateway"
import { ORG_EMAIL_SENDERS } from "@/lib/org-config"
import {
  MAX_PIN_ATTEMPTS,
  MAX_RESET_CODE_ATTEMPTS,
  PIN_LOCK_MINUTES,
  RESET_CODE_TTL_MINUTES,
  generateResetCode,
  hashSecret,
  isLocked,
  pinProblem,
  verifySecret,
} from "./pin"

const log = logger("approval-signing")

export const SIGNATURE_BUCKET = "approval_signatures"
const SIGNATURE_MAX_BYTES = 1024 * 1024
const SIGNED_URL_SECONDS = 60 * 10

/**
 * Signing credentials are server-only: every function here takes the
 * service-role client. Nothing in approval_signing_credentials is readable by a
 * client role, so no admin can read or set another person's PIN.
 */

interface CredentialRow {
  user_id: string
  signature_path: string | null
  signature_updated_at: string | null
  pin_hash: string | null
  pin_set_at: string | null
  failed_pin_attempts: number
  pin_locked_until: string | null
}

export interface SigningStatus {
  has_signature: boolean
  has_pin: boolean
  signature_url: string | null
  signature_updated_at: string | null
  pin_set_at: string | null
  pin_locked_until: string | null
}

export type SigningSetupItem = "signature" | "pin"

export class SigningError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_pin" | "locked" | "not_set" | "bad_request" | "expired",
    readonly status = 400
  ) {
    super(message)
  }
}

async function loadCredentials(admin: SupabaseClient, userId: string): Promise<CredentialRow | null> {
  const { data, error } = await admin
    .from("approval_signing_credentials")
    .select(
      "user_id, signature_path, signature_updated_at, pin_hash, pin_set_at, failed_pin_attempts, pin_locked_until"
    )
    .eq("user_id", userId)
    .maybeSingle<CredentialRow>()
  if (error) throw new Error(`Failed to load signing credentials: ${error.message}`)
  return data
}

export async function signedStorageUrl(
  admin: SupabaseClient,
  bucket: string,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error) {
    log.warn({ err: error.message, bucket }, "Failed to sign storage URL")
    return null
  }
  return data.signedUrl
}

export async function getSigningStatus(admin: SupabaseClient, userId: string): Promise<SigningStatus> {
  const row = await loadCredentials(admin, userId)
  return {
    has_signature: Boolean(row?.signature_path),
    has_pin: Boolean(row?.pin_hash),
    signature_url: await signedStorageUrl(admin, SIGNATURE_BUCKET, row?.signature_path),
    signature_updated_at: row?.signature_updated_at ?? null,
    pin_set_at: row?.pin_set_at ?? null,
    pin_locked_until: isLocked(row?.pin_locked_until) ? row!.pin_locked_until : null,
  }
}

/** What a person still has to set up before they can sign. */
export async function getMissingSetup(admin: SupabaseClient, userId: string): Promise<SigningSetupItem[]> {
  const row = await loadCredentials(admin, userId)
  const missing: SigningSetupItem[] = []
  if (!row?.signature_path) missing.push("signature")
  if (!row?.pin_hash) missing.push("pin")
  return missing
}

function lockedMessage(until: string): string {
  const time = new Date(until).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  })
  return `Too many wrong PINs. Signing is locked until ${time}.`
}

/**
 * Confirms an action with the person's PIN. Returns the signature file to stamp
 * on the action.
 */
export async function verifyActionPin(admin: SupabaseClient, userId: string, pin: string): Promise<string> {
  const row = await loadCredentials(admin, userId)
  if (!row?.signature_path || !row.pin_hash) {
    throw new SigningError("Set up your signature and approval PIN before signing.", "not_set", 403)
  }
  await checkPin(admin, row, pin)
  return row.signature_path
}

/** Checks a PIN against the lockout. Every check, right or wrong, is counted atomically. */
async function checkPin(admin: SupabaseClient, row: CredentialRow, pin: string): Promise<void> {
  const userId = row.user_id
  if (!row.pin_hash) throw new SigningError("You have not set an approval PIN yet.", "not_set", 403)
  if (isLocked(row.pin_locked_until)) {
    throw new SigningError(lockedMessage(row.pin_locked_until!), "locked", 423)
  }

  const ok = await verifySecret(pin, row.pin_hash)
  const { data, error } = await admin.rpc("approval_pin_record_attempt", {
    p_user_id: userId,
    p_success: ok,
    p_max_attempts: MAX_PIN_ATTEMPTS,
    p_lock_minutes: PIN_LOCK_MINUTES,
  })
  if (error) throw new Error(`Failed to record PIN attempt: ${error.message}`)

  if (!ok) {
    const result = (Array.isArray(data) ? data[0] : data) as
      | { failed_pin_attempts: number; pin_locked_until: string | null }
      | undefined
    if (result?.pin_locked_until && isLocked(result.pin_locked_until)) {
      throw new SigningError(lockedMessage(result.pin_locked_until), "locked", 423)
    }
    const left = MAX_PIN_ATTEMPTS - (result?.failed_pin_attempts ?? 0)
    throw new SigningError(
      `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left before signing is locked.`,
      "invalid_pin",
      401
    )
  }
}

async function upsertCredentials(admin: SupabaseClient, userId: string, values: Partial<CredentialRow>) {
  const { error } = await admin
    .from("approval_signing_credentials")
    .upsert({ user_id: userId, ...values }, { onConflict: "user_id" })
  if (error) throw new Error(`Failed to save signing credentials: ${error.message}`)
}

/**
 * Sets the PIN. Changing an existing PIN needs the current one; a forgotten PIN
 * goes through the emailed reset code instead.
 */
export async function setPin(admin: SupabaseClient, userId: string, newPin: string, currentPin?: string) {
  const problem = pinProblem(newPin)
  if (problem) throw new SigningError(problem, "bad_request")

  const row = await loadCredentials(admin, userId)
  if (row?.pin_hash) {
    if (!currentPin) throw new SigningError("Enter your current PIN to change it.", "bad_request")
    await checkPin(admin, row, currentPin)
  }

  await upsertCredentials(admin, userId, {
    pin_hash: await hashSecret(newPin),
    pin_set_at: new Date().toISOString(),
    failed_pin_attempts: 0,
    pin_locked_until: null,
  })
}

const SIGNATURE_TYPES: Record<string, { ext: string; magic: number[] }> = {
  "image/png": { ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  "image/jpeg": { ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  "image/webp": { ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] },
}

/**
 * Stores a new signature image. Files are never overwritten: past approvals
 * keep pointing at the signature that was on file when they were signed.
 */
export async function saveSignature(admin: SupabaseClient, userId: string, bytes: Buffer, contentType: string) {
  const type = SIGNATURE_TYPES[contentType]
  if (!type) throw new SigningError("Upload a PNG, JPG or WebP image.", "bad_request")
  if (bytes.length === 0 || bytes.length > SIGNATURE_MAX_BYTES) {
    throw new SigningError("The signature image must be under 1 MB.", "bad_request")
  }
  if (!type.magic.every((byte, index) => bytes[index] === byte)) {
    throw new SigningError("That file is not a valid image.", "bad_request")
  }

  const path = `${userId}/${Date.now()}.${type.ext}`
  const { error } = await admin.storage.from(SIGNATURE_BUCKET).upload(path, bytes, { contentType, upsert: false })
  if (error) throw new Error(`Failed to store signature: ${error.message}`)

  await upsertCredentials(admin, userId, { signature_path: path, signature_updated_at: new Date().toISOString() })
}

async function resolveEmail(admin: SupabaseClient, userId: string): Promise<{ email: string; firstName: string }> {
  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, company_email, additional_email")
    .eq("id", userId)
    .maybeSingle<{ first_name: string | null; company_email: string | null; additional_email: string | null }>()
  let email = (profile?.company_email || profile?.additional_email || "").trim()
  if (!email.includes("@")) {
    const { data } = await admin.auth.admin.getUserById(userId)
    email = data.user?.email || ""
  }
  if (!email.includes("@")) throw new SigningError("There is no email address on your profile.", "bad_request")
  return { email, firstName: profile?.first_name || "" }
}

function renderResetEmail(firstName: string, code: string): string {
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Your approval PIN reset code</title></head>' +
    "<body style=\"margin:0;padding:0;background:#fff;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;\">" +
    '<div style="max-width:600px;margin:0 auto;padding:32px 28px;">' +
    '<div style="font-size:20px;font-weight:700;color:#111827;margin-bottom:20px;">Reset your approval PIN</div>' +
    `<p style="font-size:14px;color:#4b5563;line-height:1.6;">Hi ${escapeHtml(firstName || "there")},</p>` +
    '<p style="font-size:14px;color:#4b5563;line-height:1.6;">Use this code to set a new approval PIN on ACOB Matrix:</p>' +
    `<div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;margin:24px 0;">${escapeHtml(code)}</div>` +
    `<p style="font-size:14px;color:#4b5563;line-height:1.6;">It expires in ${RESET_CODE_TTL_MINUTES} minutes and works once.</p>` +
    '<p style="font-size:13px;color:#9ca3af;line-height:1.6;">If you did not ask for this, ignore this email and tell IT. Your PIN has not changed.</p>' +
    "</div></body></html>"
  )
}

/** Emails a reset code to the person's own address. Older unused codes stop working. */
export async function requestPinReset(admin: SupabaseClient, userId: string): Promise<{ sentTo: string }> {
  const { email, firstName } = await resolveEmail(admin, userId)

  const { data: recent } = await admin
    .from("approval_pin_reset_codes")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString())
    .limit(1)
  if (recent?.length)
    throw new SigningError("A code was just sent. Wait a minute before asking again.", "bad_request", 429)

  await admin
    .from("approval_pin_reset_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null)

  const code = generateResetCode()
  const { error } = await admin.from("approval_pin_reset_codes").insert({
    user_id: userId,
    code_hash: await hashSecret(code),
    expires_at: new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60_000).toISOString(),
  })
  if (error) throw new Error(`Failed to create reset code: ${error.message}`)

  // A security email: sent regardless of notification preferences.
  await sendNotificationEmailWithRetry({
    from: ORG_EMAIL_SENDERS.system,
    to: [email],
    subject: "Your approval PIN reset code",
    html: renderResetEmail(firstName, code),
  })

  const [local, domain] = email.split("@")
  return { sentTo: `${local.slice(0, 2)}***@${domain}` }
}

/** Sets a new PIN using an emailed reset code. */
export async function confirmPinReset(admin: SupabaseClient, userId: string, code: string, newPin: string) {
  const problem = pinProblem(newPin)
  if (problem) throw new SigningError(problem, "bad_request")

  const { data: row } = await admin
    .from("approval_pin_reset_codes")
    .select("id, code_hash, attempts, expires_at")
    .eq("user_id", userId)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; code_hash: string; attempts: number; expires_at: string }>()

  if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= MAX_RESET_CODE_ATTEMPTS) {
    throw new SigningError("That code has expired. Ask for a new one.", "expired")
  }

  if (!(await verifySecret(code.trim(), row.code_hash))) {
    await admin
      .from("approval_pin_reset_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id)
    throw new SigningError("That code is not right.", "invalid_pin", 401)
  }

  await admin.from("approval_pin_reset_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id)
  await upsertCredentials(admin, userId, {
    pin_hash: await hashSecret(newPin),
    pin_set_at: new Date().toISOString(),
    failed_pin_attempts: 0,
    pin_locked_until: null,
  })
}
