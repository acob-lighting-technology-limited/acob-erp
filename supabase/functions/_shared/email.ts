import { Resend } from "npm:resend@2.0.0"

type EmailAttachment = {
  filename: string
  content: string
}

type SendEmailOptions = {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
  attachments?: EmailAttachment[]
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const DEFAULT_SENDER_EMAIL = Deno.env.get("NOTIFICATION_SENDER_EMAIL") || "notifications@acoblighting.com"
const DEFAULT_FROM = `ACOB Internal Systems <${DEFAULT_SENDER_EMAIL}>`
const RATE_LIMIT_INTERVAL_MS = 500
const MAX_ATTEMPTS = 3
let nextAvailableSendTime = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForRateLimit() {
  const now = Date.now()
  const waitMs = Math.max(0, nextAvailableSendTime - now)
  if (waitMs > 0) {
    await sleep(waitMs)
  }
  nextAvailableSendTime = Math.max(now, nextAvailableSendTime) + RATE_LIMIT_INTERVAL_MS
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return "Failed to send email"
}

export async function sendEmail(options: SendEmailOptions): Promise<{ id: string }> {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured")
  }

  const resend = new Resend(RESEND_API_KEY)
  const payload = {
    from: options.from || DEFAULT_FROM,
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject,
    html: options.html,
    replyTo: options.replyTo,
    attachments: options.attachments,
  }

  let attempt = 0
  while (attempt < MAX_ATTEMPTS) {
    await waitForRateLimit()

    const { data, error } = await resend.emails.send(payload)
    if (!error && data?.id) {
      return { id: data.id }
    }

    attempt += 1
    if (attempt >= MAX_ATTEMPTS) {
      throw new Error(getErrorMessage(error))
    }

    await sleep(500 * 2 ** (attempt - 1))
  }

  throw new Error("Failed to send email")
}
