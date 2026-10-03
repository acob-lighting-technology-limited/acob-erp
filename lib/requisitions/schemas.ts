import { z } from "zod"

/** The editable fields of a requisition funding category — the form and both API methods use these. */
export const FundingCategoryFieldsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  description: z.string().trim().optional(),
  sort_order: z
    .number({ invalid_type_error: "Enter a number" })
    .int("Use a whole number")
    .min(0, "Use 0 or more")
    .max(9999, "Use 9999 or less"),
})

export type FundingCategoryFields = z.infer<typeof FundingCategoryFieldsSchema>

/** POST /api/requisitions/funding-categories */
export const CreateFundingCategorySchema = FundingCategoryFieldsSchema.extend({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .regex(/^[a-z0-9_-]+$/, "Code may only contain lowercase letters, numbers, hyphens and underscores")
    .optional(),
  sort_order: FundingCategoryFieldsSchema.shape.sort_order.optional(),
})

/** PATCH /api/requisitions/funding-categories */
export const UpdateFundingCategorySchema = FundingCategoryFieldsSchema.partial().extend({
  id: z.string().uuid("A valid category id is required"),
  is_active: z.boolean().optional(),
})
