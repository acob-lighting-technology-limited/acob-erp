import { apiError, ApiErrorCode, serverError } from "@/lib/api/errors"

type ErrorLogger = { error(data: Record<string, unknown>, msg: string): void }

/** The response for a failed save_site call. Nothing was written: the function rolls back as one. */
export function siteSaveErrorResponse(log: ErrorLogger, error: unknown, fallback: string) {
  const code = (error as { code?: string } | null)?.code
  if (code === "23505") {
    return apiError(
      "A site with this name is already registered in that LGA and state.",
      ApiErrorCode.ALREADY_EXISTS,
      409
    )
  }
  if (code === "P0002") return apiError("Site not found", ApiErrorCode.NOT_FOUND, 404)
  return serverError(log, error, fallback)
}
