import crypto from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const CSRF_COOKIE = "csrf_token"
const CSRF_HEADER = "x-csrf-token"

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  })
}

export function validateCsrf(request: Request, cookieToken: string | undefined): boolean {
  const headerToken = request.headers.get(CSRF_HEADER)
  if (!headerToken || !cookieToken) return false
  if (headerToken.length !== cookieToken.length) return false
  const a = Buffer.from(headerToken)
  const b = Buffer.from(cookieToken)
  return crypto.timingSafeEqual(a, b)
}

export async function getCsrfCookie() {
  const cookieStore = await cookies()
  return cookieStore.get(CSRF_COOKIE)?.value
}
