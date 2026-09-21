"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthShell, authCardClassName } from "@/components/auth/auth-shell"
import { AuthField, AuthNotice } from "@/components/auth/auth-form-parts"
import Link from "next/link"
import { useState, useEffect } from "react"

import { toast } from "sonner"
import { Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://matrix.acoblighting.com"
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/auth/callback?next=/auth/reset-password`,
      })

      if (error) throw error

      setEmailSent(true)
      toast.success("Password reset email sent! Check your inbox.")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to send reset email"
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
            {emailSent ? "Check your email" : "Forgot password?"}
          </CardTitle>
          <CardDescription className="text-sm">
            {emailSent
              ? "We've sent a password reset link to your inbox"
              : "Enter your company email and we'll send you a reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          {emailSent ? (
            <>
              <AuthNotice variant="success">
                A reset link is on its way to {email}. It can take a minute — check your spam folder too.
              </AuthNotice>
              <div className="space-y-3">
                <Button
                  onClick={() => setEmailSent(false)}
                  variant="outline"
                  className="h-12 w-full rounded-xl text-sm font-semibold"
                >
                  Send another email
                </Button>
                <Link
                  href="/auth/login"
                  className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
                >
                  Back to login
                </Link>
              </div>
            </>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <AuthField
                id="email"
                type="email"
                label="Company email"
                icon={Mail}
                placeholder="a.nmanma@org.acoblighting.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
                hint="The address associated with your account."
              />
              <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" loading={isLoading}>
                Send reset link
              </Button>
              <Link
                href="/auth/login"
                className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
              >
                Back to login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-6 text-center text-xs">
        Having trouble? Contact your system administrator or IT support.
      </p>
    </AuthShell>
  )
}
