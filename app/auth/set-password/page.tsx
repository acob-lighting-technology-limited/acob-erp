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

export default function SetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      toast.error("Passwords do not match")
      return
    }

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
      toast.success("Password set successfully! Welcome to Matrix.")

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.replace("/profile")
      }, 2000)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to set password"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
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
            <form onSubmit={handleSetPassword} className="space-y-5">
              <AuthPasswordField
                id="password"
                label="Password"
                icon={Lock}
                placeholder="Create a strong password"
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
                label="Confirm password"
                icon={Lock}
                revealLabel="password confirmation"
                placeholder="Repeat your password"
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
                Set password and continue
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  )
}
