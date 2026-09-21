"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthShell, authCardClassName } from "@/components/auth/auth-shell"
import { AuthField, AuthNotice, AuthOtpInput, AuthPasswordField } from "@/components/auth/auth-form-parts"
import Link from "next/link"
import { useState, useEffect, useCallback, Suspense } from "react"

import { Mail, Lock } from "lucide-react"
import { formValidation } from "@/lib/validation"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { AuthPageSkeleton } from "@/components/skeletons"

import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"

const log = logger("auth-setup-account")

// Supabase enforces a 60s per-address cooldown on recovery mail plus a project-wide
// hourly cap. Mirroring the 60s here turns a raw "over_email_send_rate_limit" error
// into a visible countdown, and the attempt cap stops people burning the hourly
// project quota on an address that is never going to receive anything.
const RESEND_COOLDOWN_SECONDS = 60
const MAX_SEND_ATTEMPTS = 3

function SetupAccountContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams?.get("token")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""])
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [sendCount, setSendCount] = useState(0)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    // Check if we already have a session (came via /auth/callback)
    const checkExistingSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        // We have a valid session from the callback code exchange
        setIsRecoveryMode(true)
      }
    }
    checkExistingSession()

    // Also listen for PASSWORD_RECOVERY event (hash fragment / implicit flow)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, _session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const sendSetupEmail = useCallback(async () => {
    // Domain restriction check
    if (!formValidation.isCompanyEmail(email)) {
      toast.error("Only @acoblighting.com and @org.acoblighting.com emails are allowed.")
      return
    }

    if (resendCooldown > 0) return

    if (sendCount >= MAX_SEND_ATTEMPTS) {
      toast.error("Too many attempts. Please contact HR to have your account checked.")
      return
    }

    const supabase = createClient()
    setIsLoading(true)

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://matrix.acoblighting.com"
      // Use the callback route for proper PKCE code exchange, then redirect to setup-account
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/auth/callback?next=/auth/setup-account`,
      })

      if (error) throw error

      setSendCount((count) => count + 1)
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      setEmailSent(true)
      // Deliberately not "Setup link sent!" — Supabase returns success for addresses
      // that have no account, so a confirmed send is something we cannot promise.
      toast.success("If that email has an account, a setup code is on its way.")
    } catch (error: unknown) {
      log.error("Setup Account Error:", error)
      const message = error instanceof Error ? error.message : "Failed to send setup email"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [email, resendCooldown, sendCount])

  const handleSetupAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendSetupEmail()
  }

  const handleVerifyOtp = async () => {
    const code = otpDigits.join("")
    if (code.length !== 6) {
      toast.error("Please enter all 6 digits")
      return
    }

    setIsVerifyingOtp(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "recovery",
      })

      if (error) throw error

      // Verifying the code signs the user in, so record it like any other
      // sign-in — otherwise account setup and reset are invisible in
      // /admin/dev/login-logs.
      await apiFetch("/api/dev/login-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authMethod: "otp" }),
        keepalive: true,
      }).catch((logErr) => log.warn("dev login log failed (setup-account otp)", logErr))

      // OTP verified — session is now established, show password form
      setIsRecoveryMode(true)
      toast.success("Code verified! Now create your password.")
    } catch (err: unknown) {
      log.error("OTP Verification Error:", err)
      toast.error(err instanceof Error ? err.message : "Invalid or expired code. Please try again.")
      setOtpDigits(["", "", "", "", "", ""])
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()

      if (isRecoveryMode) {
        // Standard Supabase Recovery Flow
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
      } else {
        // Custom Initial Setup Flow
        const response = await apiFetch("/api/auth/setup-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || data.message || "Failed to activate account")
      }

      setIsSuccess(true)
      toast.success(isRecoveryMode ? "Password reset successfully!" : "Account activated successfully!")

      setTimeout(() => {
        router.push("/auth/login")
      }, 2000)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to process request")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      tagline="Secure onboarding for authorized employees to access operations, reporting, and administrative tools."
      highlights={[
        "Use your registered company email.",
        "Complete OTP or setup-link verification first.",
        "Create a strong password to activate your account.",
      ]}
    >
      <Card className={authCardClassName}>
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {isSuccess
              ? "Account activated"
              : token || isRecoveryMode
                ? isRecoveryMode
                  ? "Reset your password"
                  : "Create your password"
                : emailSent
                  ? "Check your email"
                  : "Set up your account"}
          </CardTitle>
          <CardDescription className="text-sm">
            {isSuccess
              ? "Your account is now active. Redirecting to login..."
              : token || isRecoveryMode
                ? isRecoveryMode
                  ? "Enter a new password to continue."
                  : "Create a secure password to activate your account."
                : emailSent
                  ? `If ${email} has an account, a setup code is on its way.`
                  : "Enter your company email to get started."}
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
          ) : token || isRecoveryMode ? (
            <form onSubmit={handleCreatePassword} className="space-y-5">
              <AuthPasswordField
                id="password"
                label="New password"
                icon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                minLength={6}
                autoComplete="new-password"
                placeholder="At least 6 characters"
              />
              <AuthPasswordField
                id="confirmPassword"
                label="Confirm password"
                icon={Lock}
                revealLabel="password confirmation"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Repeat your password"
              />
              <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" loading={isLoading}>
                Activate account
              </Button>
            </form>
          ) : emailSent ? (
            <div className="space-y-6">
              <p className="text-muted-foreground text-sm leading-6">
                Enter the 6-digit code sent to <span className="text-foreground font-medium">{email}</span>, or use the
                setup link in the same email. Nothing after a few minutes? The address may not have an account yet —
                contact HR.
              </p>

              <div className="space-y-3">
                <AuthOtpInput digits={otpDigits} onChange={setOtpDigits} onComplete={() => void handleVerifyOtp()} />
                <Button
                  onClick={handleVerifyOtp}
                  className="h-12 w-full rounded-xl text-sm font-semibold"
                  loading={isVerifyingOtp}
                  disabled={otpDigits.join("").length !== 6}
                >
                  Verify and continue
                </Button>
              </div>

              <div className="border-border/60 flex flex-col items-center gap-3 border-t pt-5 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setOtpDigits(["", "", "", "", "", ""])
                    void sendSetupEmail()
                  }}
                  disabled={resendCooldown > 0 || sendCount >= MAX_SEND_ATTEMPTS || isLoading}
                  className="text-primary disabled:text-muted-foreground underline-offset-4 hover:underline disabled:no-underline"
                >
                  {sendCount >= MAX_SEND_ATTEMPTS
                    ? "Resend limit reached — contact HR"
                    : resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailSent(false)
                    setOtpDigits(["", "", "", "", "", ""])
                  }}
                  className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSetupAccount} className="space-y-5">
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
                hint="We'll send a 6-digit code and a setup link to this address."
              />
              <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" loading={isLoading}>
                Send setup code
              </Button>
            </form>
          )}

          {!isSuccess && (
            <p className="text-muted-foreground border-border/60 border-t pt-5 text-center text-sm">
              Already have a password?{" "}
              <Link href="/auth/login" className="text-primary font-medium underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  )
}

export default function SetupAccountPage() {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <SetupAccountContent />
    </Suspense>
  )
}
