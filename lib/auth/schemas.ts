import { z } from "zod"

/** Body of POST /api/auth/change-password. */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: z
    .string({ required_error: "New password is required" })
    .min(6, "New password must be at least 6 characters long")
    .max(200),
})

/** The change-password form: the API body plus a confirmation that must match. */
export const ChangePasswordFormSchema = ChangePasswordSchema.extend({
  confirmPassword: z.string().min(1, "Confirm your new password"),
}).refine((values) => values.newPassword === values.confirmPassword, {
  message: "New passwords do not match",
  path: ["confirmPassword"],
})

export type ChangePasswordFormValues = z.infer<typeof ChangePasswordFormSchema>
