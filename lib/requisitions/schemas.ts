import { z } from "zod"
import {
  MAX_BENEFICIARIES,
  PETTY_CASH_MAX,
  REQUISITION_ATTACHMENT_MAX_COUNT,
  REQUISITION_ATTACHMENT_MAX_FILE_BYTES,
  REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES,
  amountOutOfRangeMessage,
  lineItemsTotal,
} from "./limits"

const money = z
  .number({ invalid_type_error: "Enter an amount in naira" })
  .positive("Amount must be greater than zero")
  .max(999_999_999.99, "That amount is too large")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, { message: "Use at most two decimal places" })

export const BeneficiarySchema = z.object({
  account_name: z.string().trim().min(1, "Account name is required").max(200),
  account_number: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Account number must be 10 digits"),
  bank_name: z.string().trim().min(1, "Bank name is required").max(120),
  /** Paystack bank code, when picked from the list. Lets the server confirm the account name. */
  bank_code: z
    .string()
    .regex(/^\d{3,6}$/)
    .optional(),
  /** What this account is being paid for, on top of the requisition's main purpose. */
  purpose: z.string().trim().max(300, "Keep each beneficiary's purpose under 300 characters").optional(),
  amount: money.optional(),
})

export const LineItemSchema = z.object({
  description: z.string().trim().min(1, "Describe the item").max(300),
  amount: money,
})

export const RequisitionAttachmentSchema = z.object({
  file_name: z.string().trim().min(1, "File name is required").max(255),
  file_path: z.string().trim().min(1, "File path is required").max(500),
  file_type: z.string().max(100).optional(),
  file_size: z
    .number()
    .int()
    .nonnegative()
    .max(
      REQUISITION_ATTACHMENT_MAX_FILE_BYTES,
      `Each file must be ${REQUISITION_ATTACHMENT_MAX_FILE_BYTES / (1024 * 1024)} MB or less`
    )
    .optional(),
  web_url: z.string().url().max(1000).nullish(),
  archived_at: z.string().max(100).nullish(),
})

const PIN = z.string().regex(/^\d{6}$/, "Enter your 6-digit approval PIN")

function checkBeneficiarySplit(
  beneficiaries: { amount?: number }[],
  total: number,
  ctx: z.RefinementCtx,
  path: (string | number)[]
) {
  if (beneficiaries.length < 2) return
  const withAmounts = beneficiaries.filter((b) => b.amount != null)
  if (withAmounts.length === 0) return
  if (withAmounts.length !== beneficiaries.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: "Give every beneficiary an amount, or none of them" })
    return
  }
  const sum = lineItemsTotal(withAmounts.map((b) => ({ amount: b.amount! })))
  if (Math.abs(sum - total) > 0.001) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: "The beneficiaries' amounts must add up to the total",
    })
  }
}

const CommonFields = {
  /** The requester's approval PIN: submitting signs "Requested by". Checked by the server, never stored. */
  pin: PIN,
  beneficiary_details: z.array(BeneficiarySchema).min(1, "Add at least one beneficiary"),
  // Supporting documents are optional — up to 20 files, max 20 MB combined.
  attachments: z
    .array(RequisitionAttachmentSchema)
    .max(REQUISITION_ATTACHMENT_MAX_COUNT, `At most ${REQUISITION_ATTACHMENT_MAX_COUNT} files allowed`)
    .refine(
      (files) =>
        !files || files.reduce((sum, f) => sum + (f.file_size || 0), 0) <= REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES,
      `Combined attachments cannot exceed ${REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES / (1024 * 1024)} MB`
    )
    .optional()
    .default([]),
}

export const PaymentRequestSchema = z
  .object({
    form_type: z.literal("payment_request"),
    /** A project from the list: the server takes its name from the database. */
    project_id: z.string().uuid().optional(),
    project_name: z.string().trim().min(1, "Project is required").max(200),
    purpose: z.string().trim().min(3, "Purpose must be at least 3 characters").max(2000),
    amount: money,
    ...CommonFields,
  })
  .superRefine((value, ctx) => {
    const range = amountOutOfRangeMessage("payment_request", value.amount)
    if (range) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: range })
    if (value.beneficiary_details.length > MAX_BENEFICIARIES.payment_request) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["beneficiary_details"],
        message: `A Payment Request has at most ${MAX_BENEFICIARIES.payment_request} beneficiaries`,
      })
    }
    checkBeneficiarySplit(value.beneficiary_details, value.amount, ctx, ["beneficiary_details"])
  })

export const PettyCashSchema = z
  .object({
    form_type: z.literal("petty_cash"),
    line_items: z.array(LineItemSchema).min(1, "Add at least one item").max(30),
    ...CommonFields,
  })
  .superRefine((value, ctx) => {
    const total = lineItemsTotal(value.line_items)
    if (total > PETTY_CASH_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["line_items"],
        message: amountOutOfRangeMessage("petty_cash", total) || "Over the petty cash limit",
      })
    }
    if (value.beneficiary_details.length > MAX_BENEFICIARIES.petty_cash) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["beneficiary_details"],
        message: `Petty Cash has at most ${MAX_BENEFICIARIES.petty_cash} beneficiaries`,
      })
    }
    checkBeneficiarySplit(value.beneficiary_details, total, ctx, ["beneficiary_details"])
  })

/** POST /api/requisitions — picks the form's schema by `form_type`. */
export function parseCreateRequisition(body: unknown) {
  const formType = (body as { form_type?: unknown } | null)?.form_type
  return formType === "petty_cash" ? PettyCashSchema.safeParse(body) : PaymentRequestSchema.safeParse(body)
}

export type PaymentRequestInput = z.input<typeof PaymentRequestSchema>
export type PettyCashInput = z.input<typeof PettyCashSchema>

/** A signer's change to the amount. Petty cash changes its lines; a Payment Request its amount. */
export const AmountChangeSchema = z.object({
  amount: money.optional(),
  line_items: z.array(LineItemSchema).min(1).max(30).optional(),
  beneficiary_details: z.array(BeneficiarySchema).min(1).max(4).optional(),
  reason: z.string().trim().min(3, "Say why the amount is changing").max(1000),
})

/** POST /api/requisitions/[id]/act */
export const RequisitionActSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sign"),
    pin: PIN,
    comments: z.string().trim().max(2000).optional(),
    amount_change: AmountChangeSchema.optional(),
  }),
  z.object({
    action: z.literal("reject"),
    pin: PIN,
    reason: z.string().trim().min(3, "Say why it is being rejected").max(2000),
  }),
])

/** POST /api/requisitions/[id]/payments */
export const RecordPaymentSchema = z.object({
  amount: money,
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the payment date"),
  method: z.enum(["transfer", "cash"]),
  reference: z.string().trim().max(200).optional(),
  receipt_path: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
  pin: PIN,
})

/** POST /api/requisitions/payment-processors */
export const PaymentProcessorSchema = z.object({
  profile_id: z.string().uuid("Pick someone"),
})
