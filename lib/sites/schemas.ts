import { z } from "zod"
import { SITE_DOCUMENT_STATUSES, SITE_DOCUMENT_TYPES } from "./conveyance"

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")

/** "" from an empty input means "not set". */
const optionalDate = z
  .union([isoDate, z.literal("")])
  .nullable()
  .optional()
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max.toLocaleString("en-NG")} characters or fewer`)
    .nullable()
    .optional()
const optionalUuid = z
  .union([z.string().uuid(), z.literal("")])
  .nullable()
  .optional()

export const SiteDocumentFieldsSchema = z
  .object({
    id: z.string().uuid().optional(),
    document_type: z.enum(SITE_DOCUMENT_TYPES),
    label: optionalText(120),
    status: z.enum(SITE_DOCUMENT_STATUSES),
    reference: optionalText(120),
    issued_on: optionalDate,
    expires_on: optionalDate,
    notes: optionalText(2000),
  })
  .refine((doc) => doc.document_type !== "other" || Boolean(doc.label?.trim()), {
    message: "Name the document",
    path: ["label"],
  })
  // ISO dates compare correctly as strings.
  .refine((doc) => !doc.issued_on || !doc.expires_on || doc.expires_on >= doc.issued_on, {
    message: "Expiry cannot be before the issue date",
    path: ["expires_on"],
  })

export type SiteDocumentFields = z.infer<typeof SiteDocumentFieldsSchema>

/** A site and its documents — the site form, POST /api/sites and PATCH /api/sites/[id]. */
export const SiteFieldsSchema = z.object({
  name: z.string().trim().min(1, "Site name is required").max(200, "Use 200 characters or fewer"),
  lga: optionalText(120),
  state: optionalText(60),
  date_signed: optionalDate,
  portfolio_id: optionalUuid,
  project_id: optionalUuid,
  notes: optionalText(5000),
  documents: z.array(SiteDocumentFieldsSchema).max(30, "A site can hold at most 30 documents"),
})

export type SiteFields = z.infer<typeof SiteFieldsSchema>
