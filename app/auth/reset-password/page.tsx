"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthShell, authCardClassName } from "@/components/auth/auth-shell"
import { AuthNotice } from "@/components/auth/auth-form-parts"
import { NewPasswordForm } from "@/components/auth/new-password-form"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { AuthPageSkeleton } from "@/components/skeletons"

export default function ResetPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const router = useRouter()

  // Check if user has a valid session from the reset link
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        toast.error("Invalid or expired reset link. Please request a new one.")
        router.push("/auth/forgot-password")
        return
      }
      setIsChecking(false)
    }

    checkSession()
  }, [router])

  if (isChecking) {
    return <AuthPageSkeleton />
  }

  const handleResetPassword = async (password: string) => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setIsSuccess(true)
    toast.success("Password reset successful!")
    setTimeout(() => {
      router.push("/auth/login")
    }, 2000)
  }

  return (
    <AuthShell>
      <Card className={authCardClassName}>
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {isSuccess ? "Password reset" : "Create new password"}
          </CardTitle>
          <CardDescription className="text-sm">
            {isSuccess ? "You can now sign in with your new password" : "Choose a strong password for your account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          {isSuccess ? (
            <>
              <AuthNotice variant="success">
                You can now sign in with your new password. Taking you to the login page…
              </AuthNotice>
              <Button asChild className="h-12 w-full rounded-xl text-sm font-semibold">
                <Link href="/auth/login">Go to login</Link>
              </Button>
            </>
          ) : (
            <NewPasswordForm
              passwordLabel="New password"
              passwordPlaceholder="Enter new password"
              confirmLabel="Confirm new password"
              confirmPlaceholder="Confirm new password"
              submitLabel="Reset password"
              onSubmit={handleResetPassword}
              footer={
                <Link
                  href="/auth/login"
                  className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
                >
                  Cancel
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>
    </AuthShell>
  )
}
