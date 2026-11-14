import { z } from "zod"

export const employeeDateFields = ["birthday", "confirmation_date", "employment_date"] as const
export type EmployeeDateField = (typeof employeeDateFields)[number]

export const employeeDateEditSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("birthday"),
    value: z
      .string()
      .regex(/^\d{2}-\d{2}$/)
      .refine((value) => z.string().date().safeParse(`2000-${value}`).success, "Enter a valid birthday in MM-DD format")
      .or(z.literal("")),
  }),
  z.object({ field: z.literal("confirmation_date"), value: z.string().date().or(z.literal("")) }),
  z.object({ field: z.literal("employment_date"), value: z.string().date().or(z.literal("")) }),
])
