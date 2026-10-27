// Plain module on purpose, not "use client": it has no React in it and guards every browser global,
// and lib code that is shared with route handlers imports it. Calling it on the server just sends a
// plain fetch.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * The CSRF token middleware expects echoed back as x-csrf-token.
 *
 * Exported for the few callers that cannot go through apiFetch — notably
 * XMLHttpRequest uploads, which are used where upload progress is needed.
 * Those must set the header themselves or middleware rejects them with 403.
 */
export function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Returns the dept_id when the caller is rendered inside the /dept/[dept_id]/
 * console, otherwise null.
 *
 * Many dept pages reuse the *admin* view components, which call the shared
 * /api/hr/... and /api/admin/... routes. Those routes resolve scope from the
 * user's profile, so an admin who also leads a department would otherwise be
 * served every department's data while sitting in one department's console.
 * Sending the console's dept_id lets the server narrow to it.
 *
 * This value is a hint only — the server re-resolves lead membership from the
 * database, so it can narrow access but never widen it.
 */
export function readDeptContext(): string | null {
  if (typeof window === "undefined") return null
  const match = window.location.pathname.match(/^\/dept\/([^/]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Drop-in replacement for fetch() against same-origin API routes. Injects the
 * x-csrf-token header (read from the csrf_token cookie set by middleware) on
 * state-changing requests, so the server's double-submit check can be enforced,
 * and x-dept-context on every request made from the department console.
 *
 * Use this instead of the global fetch() for any client-side call to /api/*.
 */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || "GET").toUpperCase()
  const csrfToken = MUTATING_METHODS.has(method) ? readCsrfCookie() : null
  const deptContext = readDeptContext()

  if (!csrfToken && !deptContext) {
    return fetch(input, init)
  }

  const headers = new Headers(init.headers)
  if (csrfToken) headers.set("x-csrf-token", csrfToken)
  if (deptContext) headers.set("x-dept-context", deptContext)

  return fetch(input, { ...init, headers })
}

/**
 * apiFetch + JSON parse + throw on a non-2xx status, using the route's
 * `{ error }` body as the message. The standard queryFn for React Query:
 *
 *   useQuery({ queryKey: ["maintenance"], queryFn: () => apiJson<State>("/api/dev/maintenance") })
 */
export async function apiJson<T = unknown>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(input, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `Request failed (${response.status})`
    const fields = payload?.details?.fields
    throw new ApiError(message, response.status, fields && typeof fields === "object" ? fields : {})
  }
  return payload as T
}

/**
 * A non-2xx response from `apiJson`. `fields` holds the per-field messages a
 * route's zod validation returned (`validationError` in lib/api/errors), keyed
 * by field path, so a form can show each one under its own input.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {}
  ) {
    super(message)
    this.name = "ApiError"
  }
}
