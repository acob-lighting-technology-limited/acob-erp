export const ApiErrorCode = {
  // Auth
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  // Input
  VALIDATION_ERROR: "VALIDATION_ERROR",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",
  // Business logic
  ALREADY_EXISTS: "ALREADY_EXISTS",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INVALID_STATE: "INVALID_STATE",
  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode]

export function apiError(message: string, code: ApiErrorCode, status: number, details?: unknown) {
  return Response.json({ error: message, code, ...(details ? { details } : {}) }, { status })
}

// Postgres / PostgREST codes that map to a meaningful client status. Anything
// else is an internal failure whose detail stays in the server log.
const KNOWN_DB_ERRORS: Record<string, { status: number; code: ApiErrorCode; message: string }> = {
  "23505": { status: 409, code: ApiErrorCode.ALREADY_EXISTS, message: "This record already exists." },
  "23503": { status: 409, code: ApiErrorCode.CONFLICT, message: "This record is linked to other data." },
  "23514": { status: 400, code: ApiErrorCode.VALIDATION_ERROR, message: "A value is not allowed." },
  "23502": { status: 400, code: ApiErrorCode.MISSING_REQUIRED_FIELD, message: "A required value is missing." },
  "42501": { status: 403, code: ApiErrorCode.FORBIDDEN, message: "You do not have permission to do this." },
  "22P02": { status: 400, code: ApiErrorCode.VALIDATION_ERROR, message: "A value is in the wrong format." },
  "22001": { status: 400, code: ApiErrorCode.VALIDATION_ERROR, message: "A value is too long." },
  "22007": { status: 400, code: ApiErrorCode.VALIDATION_ERROR, message: "A date or time is not valid." },
  "57014": { status: 503, code: ApiErrorCode.INTERNAL_ERROR, message: "That took too long. Please try again." },
  PGRST116: { status: 404, code: ApiErrorCode.NOT_FOUND, message: "Record not found." },
}

interface ErrorLogger {
  error(data: Record<string, unknown>, msg: string): void
}

function errorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code
    return typeof code === "string" ? code : undefined
  }
  return undefined
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return String(err)
}

/**
 * Log a server-side failure and return a response that never leaks database
 * detail (table, column or constraint names) to the client. Known Postgres
 * codes become a friendly 4xx; everything else is a generic 500.
 *
 *   if (error) return serverError(log, error, "Could not save the request")
 */
export function serverError(log: ErrorLogger, err: unknown, message = "Something went wrong. Please try again.") {
  const code = errorCode(err)
  log.error({ err: errorText(err), code }, message)
  const known = code ? KNOWN_DB_ERRORS[code] : undefined
  if (known) return apiError(known.message, known.code, known.status)
  return apiError(message, ApiErrorCode.INTERNAL_ERROR, 500)
}

/** 400 response listing the zod issues by field path. */
export function validationError(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>) {
  const fields: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_"
    if (!fields[key]) fields[key] = issue.message
  }
  return apiError(issues[0]?.message ?? "Invalid request body", ApiErrorCode.VALIDATION_ERROR, 400, { fields })
}
