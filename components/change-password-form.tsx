"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { apiJson } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PasswordInput } from "@/components/ui/password-input"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { KeyRound, ShieldCheck } from "lucide-react"
import { applyServerErrors } from "@/lib/forms/server-errors"
import { ChangePasswordFormSchema, type ChangePasswordFormValues } from "@/lib/auth/schemas"

const EMPTY: ChangePasswordFormValues = { currentPassword: "", newPassword: "", confirmPassword: "" }

export function ChangePasswordForm() {
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(ChangePasswordFormSchema),
    defaultValues: EMPTY,
  })

  const change = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      apiJson("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword || undefined,
          newPassword: values.newPassword,
        }),
      }),
    onSuccess: () => {
      toast.success("Password updated successfully! A confirmation email has been sent.")
      form.reset(EMPTY)
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, Object.keys(form.getValues()))
      if (message) toast.error(message)
    },
  })

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Security & Password</CardTitle>
            <CardDescription className="text-sm">
              Update your account password to keep your profile secure
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => change.mutate(values))} className="max-w-md space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="Enter current password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Verify your current password before setting a new one.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="Enter new password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">Must be at least 6 characters long.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="Confirm new password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" loading={change.isPending} className="mt-2">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Update Password
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
