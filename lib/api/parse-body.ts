import type { z } from "zod"
import { validationError } from "@/lib/api/errors"

/**
 * Read and validate a JSON request body in one step.
 *
 *   const parsed = await parseJsonBody(request, CreateThingSchema)
 *   if (!parsed.ok) return parsed.response
 *   const body = parsed.data
 *
 * Malformed JSON and schema failures both return a 400 with per-field messages.
 */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Request body must be valid JSON", code: "VALIDATION_ERROR" }, { status: 400 }),
    }
  }
  const result = schema.safeParse(raw)
  if (!result.success) return { ok: false, response: validationError(result.error.issues) }
  return { ok: true, data: result.data }
}
