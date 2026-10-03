import type { FieldValues, Path, UseFormSetError } from "react-hook-form"
import { ApiError } from "@/lib/api-client"

/**
 * After a failed submit: put each field message the API returned under its
 * input, and return the message for a toast — only when no field claimed the
 * error, so the reader isn't told the same thing twice.
 *
 *   onError: (err) => {
 *     const message = applyServerErrors(err, form.setError, Object.keys(form.getValues()))
 *     if (message) toast.error(message)
 *   }
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldNames: readonly string[]
): string | null {
  const fallback = error instanceof Error ? error.message : "Something went wrong. Please try again."
  if (!(error instanceof ApiError)) return fallback
  let placed = 0
  for (const [path, message] of Object.entries(error.fields)) {
    if (fieldNames.includes(path.split(".")[0])) {
      setError(path as Path<T>, { type: "server", message })
      placed++
    }
  }
  return placed > 0 ? null : fallback
}
