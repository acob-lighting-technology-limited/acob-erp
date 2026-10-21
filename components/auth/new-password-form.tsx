"use client"

import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Lock } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AuthNotice, AuthPasswordField } from "@/components/auth/auth-form-parts"
import { NewPasswordFormSchema, type NewPasswordFormValues } from "@/lib/auth/schemas"

function strengthLabel(password: string) {
  if (password.length < 6) return "Too short"
  if (password.length < 8) return "Okay"
  return /[A-Z]/.test(password) && /\d/.test(password) ? "Strong" : "Good — add an uppercase letter and a number"
}

/**
 * The "choose a new password" form shared by /auth/reset-password and
 * /auth/set-password: password + confirmation, a strength meter, and the
 * caller's submit (which throws on failure; its message is shown below).
 */
export function NewPasswordForm({
  passwordLabel,
  passwordPlaceholder,
  confirmLabel,
  confirmPlaceholder,
  submitLabel,
  onSubmit,
  footer,
}: {
  passwordLabel: string
  passwordPlaceholder: string
  confirmLabel: string
  confirmPlaceholder: string
  submitLabel: string
  onSubmit: (password: string) => Promise<void>
  footer?: ReactNode
}) {
  const form = useForm<NewPasswordFormValues>({
    resolver: zodResolver(NewPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })
  const password = useWatch({ control: form.control, name: "password" })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values.password)
    } catch (error) {
      form.setError("root", { message: error instanceof Error ? error.message : "Something went wrong" })
    }
  })

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <AuthPasswordField
        id="password"
        label={passwordLabel}
        icon={Lock}
        placeholder={passwordPlaceholder}
        autoFocus
        autoComplete="new-password"
        hint="At least 6 characters."
        error={errors.password?.message}
        {...form.register("password")}
      />
      <AuthPasswordField
        id="confirmPassword"
        label={confirmLabel}
        icon={Lock}
        revealLabel="password confirmation"
        placeholder={confirmPlaceholder}
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register("confirmPassword")}
      />
      {password.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <span className={`h-1 flex-1 rounded-full ${password.length >= 6 ? "bg-primary" : "bg-destructive/60"}`} />
            <span className={`h-1 flex-1 rounded-full ${password.length >= 8 ? "bg-primary" : "bg-muted"}`} />
            <span
              className={`h-1 flex-1 rounded-full ${/[A-Z]/.test(password) && /\d/.test(password) ? "bg-primary" : "bg-muted"}`}
            />
          </div>
          <p className="text-muted-foreground text-xs">{strengthLabel(password)}</p>
        </div>
      )}
      {errors.root?.message && <AuthNotice>{errors.root.message}</AuthNotice>}
      <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" loading={isSubmitting}>
        {submitLabel}
      </Button>
      {footer}
    </form>
  )
}
