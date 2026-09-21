"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { KeyRound, Mail, Lock } from "lucide-react"
import { AuthShell, authCardClassName } from "@/components/auth/auth-shell"
import {
  AuthField,
  AuthMethodSwitch,
  AuthNotice,
  AuthOtpInput,
  AuthPasswordField,
} from "@/components/auth/auth-form-parts"

import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"

const log = logger("auth-login")

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""])
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password")
  const [step, setStep] = useState<"credentials" | "otp">("credentials")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()

  // Handle hash-based auth handoff (e.g. developer impersonation magic links)
  // after middleware redirects unauthenticated requests back to /auth/login.
  useEffect(() => {
    const hash = window.location.hash || ""
    if (!hash.includes("access_token=") || !hash.includes("refresh_token=")) return

    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    const hashError = params.get("error_description") || params.get("error")

    if (hashError) {
      const message = decodeURIComponent(hashError)
      setError(message)
      toast.error(message)
      return
    }

    if (!accessToken || !refreshToken) return

    let cancelled = false
    const run = async () => {
      const supabase = createClient()
      setIsLoading(true)
      setError(null)

      const trySetSession = async () => {
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!result.error) return result
        await new Promise((resolve) => setTimeout(resolve, 150))
        return supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
      }

      try {
        const { error } = await trySetSession()
        if (error) throw error

        await apiFetch("/api/dev/login-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authMethod: "otp" }),
          keepalive: true,
        }).catch((err) => log.warn("dev login log failed (hash handoff)", err))

        const nextPath = getSafeNextPath(searchParams.get("next"))
        // Remove sensitive fragment and force navigation after session handoff.
        window.history.replaceState(null, "", window.location.pathname + window.location.search)
        window.location.assign(nextPath)
      } catch (sessionError: unknown) {
        const message = sessionError instanceof Error ? sessionError.message : "Failed to complete sign-in"
        setError(`${message}. Click the copied link again to retry.`)
        toast.error("Magic link sign-in failed. Please retry with a fresh link.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault()

    // Domain restriction check
    const allowedDomains = ["acoblighting.com", "org.acoblighting.com"]
    const domain = email.split("@")[1]?.toLowerCase()
    if (!domain || !allowedDomains.includes(domain)) {
      const msg = "Only @acoblighting.com and @org.acoblighting.com emails are allowed."
      setError(msg)
      toast.error(msg)
      return
    }

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // Only allow existing users
          emailRedirectTo: undefined, // No redirect → OTP code only
        },
      })
      if (error) throw error
      toast.success("A 6-digit code has been sent to your email")
      setStep("otp")
    } catch (error: unknown) {
      log.error("OTP Request Error:", error)
      let displayMessage = error instanceof Error ? error.message : "An error occurred"
      if (displayMessage.includes("Signups not allowed")) {
        displayMessage = "This email is not registered. Please contact your administrator."
      }
      setError(displayMessage)
      toast.error(displayMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    // Domain restriction check
    const allowedDomains = ["acoblighting.com", "org.acoblighting.com"]
    const domain = email.split("@")[1]?.toLowerCase()
    if (!domain || !allowedDomains.includes(domain)) {
      const msg = "Only @acoblighting.com and @org.acoblighting.com emails are allowed."
      setError(msg)
      toast.error(msg)
      return
    }

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      await apiFetch("/api/dev/login-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authMethod: "password" }),
        keepalive: true,
      }).catch((err) => log.warn("dev login log failed (password)", err))
      toast.success("Login successful!")
      const nextPath = getSafeNextPath(searchParams.get("next"))
      window.location.href = nextPath
    } catch (error: unknown) {
      log.error("Password Login Error:", error)
      const message = error instanceof Error ? error.message : "Invalid email or password"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e?: React.FormEvent, code?: string) => {
    if (e) e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    const otpCode = code || otpDigits.join("")
    if (otpCode.length !== 6) {
      setError("Please enter all 6 digits")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      })
      if (error) throw error
      await apiFetch("/api/dev/login-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authMethod: "otp" }),
        keepalive: true,
      }).catch((err) => log.warn("dev login log failed (otp)", err))
      toast.success("Login successful!")
      const nextPath = getSafeNextPath(searchParams.get("next"))
      window.location.href = nextPath
    } catch (error: unknown) {
      log.error("OTP Verification Error:", error)
      const message = error instanceof Error ? error.message : "Invalid OTP"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      highlights={[
        "Use your company email domain to sign in.",
        "Choose password or one-time code based on your access setup.",
        "Contact Admin and HR if your account has not been provisioned.",
      ]}
    >
      <Card className={authCardClassName}>
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {step === "credentials" ? "Welcome back" : "Check your email"}
          </CardTitle>
          <CardDescription className="text-sm">
            {step === "credentials" ? "Sign in to Matrix." : `We sent a 6-digit code to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          {step === "credentials" ? (
            <>
              <AuthMethodSwitch
                value={loginMethod}
                onChange={(value) => {
                  setLoginMethod(value as "password" | "otp")
                  setError(null)
                }}
                options={[
                  { value: "password", label: "Password", icon: KeyRound },
                  { value: "otp", label: "One-Time Code", icon: Mail },
                ]}
              />

              {loginMethod === "password" ? (
                <form onSubmit={handlePasswordLogin} className="space-y-5">
                  <AuthField
                    id="email"
                    name="email"
                    type="email"
                    label="Company email"
                    icon={Mail}
                    placeholder="a.nmanma@org.acoblighting.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                  <AuthPasswordField
                    id="password"
                    name="password"
                    label="Password"
                    icon={Lock}
                    placeholder="Enter your password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    action={
                      <Link
                        href="/auth/forgot-password"
                        className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    }
                  />
                  {error && <AuthNotice>{error}</AuthNotice>}
                  <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" loading={isLoading}>
                    Sign in
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRequestOTP} className="space-y-5">
                  <AuthField
                    id="email-otp"
                    type="email"
                    label="Company email"
                    icon={Mail}
                    placeholder="a.nmanma@org.acoblighting.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    hint="We'll email you a 6-digit code instead of a password."
                  />
                  {error && <AuthNotice>{error}</AuthNotice>}
                  <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" loading={isLoading}>
                    Send one-time code
                  </Button>
                </form>
              )}

              <p className="text-muted-foreground border-border/60 border-t pt-5 text-center text-sm">
                First time here?{" "}
                <Link
                  href="/auth/setup-account"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Set up your account
                </Link>
              </p>
            </>
          ) : (
            <form onSubmit={(e) => handleVerifyOTP(e)} className="space-y-6">
              <AuthOtpInput
                digits={otpDigits}
                onChange={setOtpDigits}
                onComplete={(code) => handleVerifyOTP(undefined, code)}
              />
              {error && <AuthNotice>{error}</AuthNotice>}
              <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" loading={isLoading}>
                Verify and sign in
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep("credentials")
                  setOtpDigits(["", "", "", "", "", ""])
                  setError(null)
                }}
                className="text-muted-foreground hover:text-foreground w-full text-center text-sm underline-offset-4 hover:underline"
              >
                Use a different email
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  )
}

function getSafeNextPath(next: string | null): string {
  if (!next) return "/profile"

  if (
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes(":") &&
    !/https?:\/\//i.test(next) &&
    !/[\r\n]/.test(next)
  ) {
    return next
  }

  return "/profile"
}
