import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { serverError, validationError } from "@/lib/api/errors"

const log = logger("profile-update")

// Self-service profile edits. Only personal/contact fields are accepted here:
// department, designation, role, employment status and admin access are HR/admin
// managed and go through the admin employee routes. The DB enforces the same
// split with column-level UPDATE grants on `profiles`.
const UpdateProfileSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required").max(100),
    last_name: z.string().trim().min(1, "Last name is required").max(100),
    other_names: z.string().trim().max(100).nullable(),
    phone_number: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{7,15}$/, "Enter a valid phone number")
      .or(z.literal(""))
      .nullable(),
    additional_phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{7,15}$/, "Enter a valid phone number")
      .or(z.literal(""))
      .nullable(),
    residential_address: z.string().trim().max(500).nullable(),
    office_location: z.string().trim().max(200).nullable(),
    email_notifications: z.boolean(),
    birthday: z.string().regex(/^\d{2}-\d{2}$/, "Birthday must be MM-DD"),
    birth_year: z.number().int().min(1900).max(2100).nullable(),
    job_description: z.string().max(20000).nullable(),
  })
  .partial()
  .strict()
  .refine((d) => !d.additional_phone || d.additional_phone !== d.phone_number, {
    path: ["additional_phone"],
    message: "Additional phone number must be different from primary phone number",
  })

export async function PATCH(request: Request) {
  const rl = await rateLimit(`profile-update:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = UpdateProfileSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Partial update: only the keys the client sent are written, so a form that
  // omits a field never blanks a value HR populated.
  const payload: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() }
  for (const key of ["phone_number", "additional_phone"] as const) {
    if (payload[key] === "") payload[key] = null
  }
  if ("job_description" in parsed.data) payload.job_description_updated_at = payload.updated_at

  const { error } = await supabase.from("profiles").update(payload).eq("id", user.id)
  if (error) return serverError(log, error, "Could not update your profile")

  await writeAuditLog(
    supabase,
    {
      action: "update",
      entityType: "profile",
      entityId: user.id,
      newValues: payload,
      context: { actorId: user.id, source: "api", route: "/api/profile/update" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ ok: true })
}
