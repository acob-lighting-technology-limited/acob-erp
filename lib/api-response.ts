/**
 * Standardised API response helpers.
 *
 * Every API route should return responses through these helpers so that:
 * - Success and error shapes are consistent across all endpoints
 * - HTTP status codes are set correctly in one place
 * - Callers can discriminate responses by checking `data` vs `error`
 *
 * Usage:
 *   import { apiOk, apiErr, apiUnauthorized, apiForbidden } from "@/lib/api-response"
 *
 *   return apiOk({ user })           // 200 { data: { user } }
 *   return apiUnauthorized()          // 401 { error: "Unauthorized" }
 *   return apiBadRequest("...")       // 400 { error: "..." }
 *   return apiServerError()           // 500 { error: "Internal server error" }
 */

import { NextResponse } from "next/server"

export interface ApiOkResponse<T> {
  data: T
}

export interface ApiErrResponse {
  error: string
}

export function apiOk<T>(data: T, status = 200): NextResponse<ApiOkResponse<T>> {
  return NextResponse.json({ data }, { status })
}

export function apiErr(message: string, status: number): NextResponse<ApiErrResponse> {
  return NextResponse.json({ error: message }, { status })
}

export const apiUnauthorized = () => apiErr("Unauthorized", 401)
export const apiForbidden = (msg = "Forbidden") => apiErr(msg, 403)
export const apiNotFound = (msg = "Not found") => apiErr(msg, 404)
export const apiBadRequest = (msg: string) => apiErr(msg, 400)
export const apiUnprocessable = (msg: string) => apiErr(msg, 422)
export const apiServerError = (msg = "Internal server error") => apiErr(msg, 500)
export const apiTooManyRequests = (msg = "Too many requests. Please try again later.") => apiErr(msg, 429)
