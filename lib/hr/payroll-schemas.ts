import { z } from "zod"

/** Request-body schemas for the admin payroll routes. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Use a YYYY-MM-DD date")
const money = z.number().finite().min(0)

export const CreatePayrollPeriodSchema = z.object({
  name: z.string().trim().min(1, "Missing required fields").max(100),
  start_date: isoDate,
  end_date: isoDate,
  pay_date: isoDate,
})

export const RunPayrollSchema = z.object({
  payroll_period_id: z.string().uuid("Missing required fields"),
  overrides: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        bonus: money.optional(),
        loanRepayment: money.optional(),
        /** Per-period override of the contract base salary. */
        monthlyBase: money.optional(),
        /** Annual communication allowance override (calculatePayroll's own unit). */
        communicationConfig: money.optional(),
      })
    )
    .max(1000),
  lockPeriod: z.boolean().optional(),
})

const SalaryUpdateSchema = z.object({
  user_id: z.string().uuid(),
  gross_salary: money,
  effective_from: isoDate.optional(),
})

/** Either one salary or a batch `{ updates: [...] }`. */
export const UpsertSalarySchema = z.union([
  z.object({ updates: z.array(SalaryUpdateSchema).min(1, "No updates provided").max(1000) }),
  SalaryUpdateSchema,
])

export const PayslipEmailSchema = z.object({
  payroll_period_id: z.string().uuid("payroll_period_id and user_id are required"),
  user_id: z.string().uuid("payroll_period_id and user_id are required"),
  protect: z.boolean().optional(),
})

export const PayslipBulkEmailSchema = z.object({
  payroll_period_id: z.string().uuid("payroll_period_id is required"),
  protect: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
})
