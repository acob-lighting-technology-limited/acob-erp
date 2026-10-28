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

export default function SetPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const router = useRouter()

  // Check if user has a valid session from the invite link
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        toast.error("Invalid or expired invitation link. Please contact your administrator.")
        router.push("/auth/login")
        return
      }
      setIsChecking(false)
    }

    checkSession()
  }, [router])

  const handleSetPassword = async (password: string) => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setIsSuccess(true)
    toast.success("Password set successfully! Welcome to Matrix.")
    setTimeout(() => {
      router.replace("/profile")
    }, 2000)
  }

  if (isChecking) {
    return <AuthPageSkeleton />
  }

  return (
    <AuthShell>
      <Card className={authCardClassName}>
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {isSuccess ? "You're all set!" : "Set your password"}
          </CardTitle>
          <CardDescription className="text-sm">
            {isSuccess
              ? "Redirecting to your dashboard..."
              : "Create a secure password to activate your Matrix account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          {isSuccess ? (
            <>
              <AuthNotice variant="success">Your password is set. Taking you to your dashboard…</AuthNotice>
              <Button asChild className="h-12 w-full rounded-xl text-sm font-semibold">
                <Link href="/profile">Go to dashboard</Link>
              </Button>
            </>
          ) : (
            <NewPasswordForm
              passwordLabel="Password"
              passwordPlaceholder="Create a strong password"
              confirmLabel="Confirm password"
              confirmPlaceholder="Repeat your password"
              submitLabel="Set password and continue"
              onSubmit={handleSetPassword}
            />
          )}
        </CardContent>
      </Card>
    </AuthShell>
  )
}
