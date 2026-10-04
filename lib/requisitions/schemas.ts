import { z } from "zod"
import { EMERGENCY_JUSTIFICATION_MIN_LENGTH } from "./workflow"

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

export const BeneficiarySchema = z.object({
  account_name: z.string().trim().min(1, "Account name is required"),
  account_number: z.string().trim().min(1, "Account number is required"),
  bank_name: z.string().trim().min(1, "Bank name is required"),
  amount: z.union([z.number(), z.string()]).optional(),
})

export const RequisitionAttachmentSchema = z.object({
  file_name: z.string().trim().min(1, "File name is required"),
  file_url: z.string().trim().min(1, "File URL is required"),
  file_type: z.string().optional(),
  file_size: z.number().optional(),
})

const RequisitionBaseSchema = z.object({
  department: z.string().trim().min(1, "Department is required"),
  project_name: z.string().trim().min(1, "Project name is required"),
  amount: z.number({ invalid_type_error: "Enter the amount in naira" }).positive("Amount must be greater than zero"),
  amount_in_words: z.string().optional(),
  purpose: z.string().trim().min(3, "Purpose must be at least 3 characters"),
  beneficiary_details: z.array(BeneficiarySchema).min(1, "At least one beneficiary is required"),
  // Supporting documents are optional — not every requisition has a receipt or
  // invoice available at the time it is raised.
  attachments: z.array(RequisitionAttachmentSchema).optional().default([]),
  funding_category_id: z.string().uuid("Select the project funding category"),
  is_emergency: z.boolean().optional(),
  emergency_justification: z.string().trim().optional(),
})

function requireEmergencyJustification(
  value: { is_emergency?: boolean; emergency_justification?: string },
  ctx: z.RefinementCtx
) {
  if (value.is_emergency && (value.emergency_justification ?? "").trim().length < EMERGENCY_JUSTIFICATION_MIN_LENGTH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergency_justification"],
      message: `An emergency requisition needs a written justification of at least ${EMERGENCY_JUSTIFICATION_MIN_LENGTH} characters.`,
    })
  }
}

/** POST /api/requisitions */
export const CreateRequisitionSchema = RequisitionBaseSchema.superRefine(requireEmergencyJustification)

/** The new-requisition form: everything but the department, which comes from the requester's profile. */
export const RequisitionFormSchema = RequisitionBaseSchema.omit({ department: true }).superRefine(
  requireEmergencyJustification
)

export type RequisitionFormValues = z.input<typeof RequisitionFormSchema>
