"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthShell, authCardClassName } from "@/components/auth/auth-shell"
import { AuthNotice, AuthPasswordField } from "@/components/auth/auth-form-parts"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Lock } from "lucide-react"
import { AuthPageSkeleton } from "@/components/skeletons"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      toast.error("Passwords do not match")
      return
    }

    // Validate password strength
    if (password.length < 6) {
      setError("Password must be at least 6 characters long")
      toast.error("Password must be at least 6 characters long")
      return
    }

    const supabase = createClient()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      setIsSuccess(true)
      toast.success("Password reset successful!")

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/auth/login")
      }, 2000)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to reset password"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
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
            <form onSubmit={handleResetPassword} className="space-y-5">
              <AuthPasswordField
                id="password"
                label="New password"
                icon={Lock}
                placeholder="Enter new password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                minLength={6}
                autoComplete="new-password"
                hint="At least 6 characters."
              />
              <AuthPasswordField
                id="confirmPassword"
                label="Confirm new password"
                icon={Lock}
                revealLabel="password confirmation"
                placeholder="Confirm new password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
              />
              {password.length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <span
                      className={`h-1 flex-1 rounded-full ${password.length >= 6 ? "bg-primary" : "bg-destructive/60"}`}
                    />
                    <span className={`h-1 flex-1 rounded-full ${password.length >= 8 ? "bg-primary" : "bg-muted"}`} />
                    <span
                      className={`h-1 flex-1 rounded-full ${/[A-Z]/.test(password) && /\d/.test(password) ? "bg-primary" : "bg-muted"}`}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {password.length < 6
                      ? "Too short"
                      : password.length < 8
                        ? "Okay"
                        : /[A-Z]/.test(password) && /\d/.test(password)
                          ? "Strong"
                          : "Good — add an uppercase letter and a number"}
                  </p>
                </div>
              )}
              {error && <AuthNotice>{error}</AuthNotice>}
              <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" loading={isLoading}>
                Reset password
              </Button>
              <Link
                href="/auth/login"
                className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
              >
                Cancel
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  )
}
