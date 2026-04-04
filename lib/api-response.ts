import crypto from "crypto"
import { NextResponse } from "next/server"

/**
 * Standardized API response helpers.
 *
 * Usage:
 *   return apiOk({ user })                  // 200 { success: true, data: { user } }
 *   return apiOk({ user }, 201)             // 201 { success: true, data: { user } }
 *   return apiErr("Not found", 404)         // 404 { success: false, error: "Not found" }
 *   return apiErr("Unauthorized", 401)      // 401
 *
 * All API routes should use these helpers so the frontend can rely on a
 * consistent envelope: `{ success: boolean, data?: T, error?: string }`.
 */

export type ApiOkResponse<T = unknown> = {
  success: true
  data: T
}

export type ApiErrResponse = {
  success: false
  error: string
}

/**
 * Return a successful JSON response.
 * @param data    - The payload to return under `data`
 * @param status  - HTTP status code (default 200)
 */
export function apiOk<T = unknown>(data: T, status = 200): NextResponse<ApiOkResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

/**
 * Return an error JSON response.
 * @param message - Human-readable error message (never include internal stack traces)
 * @param status  - HTTP status code (4xx or 5xx)
 */
export function apiErr(message: string, status: number): NextResponse<ApiErrResponse> {
  return NextResponse.json({ success: false, error: message }, { status })
}

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID()
}

// Convenience aliases for common status codes
export const apiUnauthorized = () => apiErr("Unauthorized", 401)
export const apiForbidden = (msg = "Forbidden") => apiErr(msg, 403)
export const apiNotFound = (msg = "Not found") => apiErr(msg, 404)
export const apiBadRequest = (msg: string) => apiErr(msg, 400)
export const apiUnprocessable = (msg: string) => apiErr(msg, 422)
export const apiServerError = (msg = "An unexpected error occurred. Please try again.") => apiErr(msg, 500)
