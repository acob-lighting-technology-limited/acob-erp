"use client"

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export function csrfHeaders(): HeadersInit {
  const token = getCsrfToken()
  return token ? { "x-csrf-token": token } : {}
}
