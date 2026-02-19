"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState, useEffect, useRef, useCallback, Suspense } from "react"

import { ArrowLeft, UserPlus, CheckCircle2, Lock, Eye, EyeOff, CheckCircle, KeyRound } from "lucide-react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { formValidation } from "@/lib/validation"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"

function SetupAccountContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams?.get("token")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""])
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const { resolvedTheme } = useTheme()

  // Default to light logo for SSR to prevent hydration mismatch
  const logoSrc = !mounted
    ? "/images/acob-logo-light.webp"
    : resolvedTheme === "dark"
      ? "/images/acob-logo-dark.webp"
      : "/images/acob-logo-light.webp"

  useEffect(() => {
    setMounted(true)

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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSetupAccount = async (e: React.FormEvent) => {
    e.preventDefault()

    // Domain restriction check
    if (!formValidation.isCompanyEmail(email)) {
      toast.error("Only @acoblighting.com and @org.acoblighting.com emails are allowed.")
      return
    }

    const supabase = createClient()
    setIsLoading(true)

    try {
      // Use the callback route for proper PKCE code exchange, then redirect to setup-account
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/setup-account`,
      })

      if (error) throw error

      setEmailSent(true)
      toast.success("Setup link sent! Check your inbox.")
    } catch (error: unknown) {
      console.error("Setup Account Error:", error)
      const message = error instanceof Error ? error.message : "Failed to send setup email"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  // OTP digit handlers
  const handleOtpChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return // only digits
      const newDigits = [...otpDigits]
      newDigits[index] = value.slice(-1)
      setOtpDigits(newDigits)
      // Auto-focus next input
      if (value && index < 5) {
        otpRefs.current[index + 1]?.focus()
      }
    },
    [otpDigits]
  )

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
        otpRefs.current[index - 1]?.focus()
      }
    },
    [otpDigits]
  )

  const handleOtpPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
      if (pasted.length > 0) {
        const newDigits = [...otpDigits]
        for (let i = 0; i < pasted.length; i++) {
          newDigits[i] = pasted[i]
        }
        setOtpDigits(newDigits)
        const focusIndex = Math.min(pasted.length, 5)
        otpRefs.current[focusIndex]?.focus()
      }
    },
    [otpDigits]
  )

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

      // OTP verified — session is now established, show password form
      setIsRecoveryMode(true)
      toast.success("Code verified! Now create your password.")
    } catch (err: any) {
      console.error("OTP Verification Error:", err)
      toast.error(err.message || "Invalid or expired code. Please try again.")
      setOtpDigits(["", "", "", "", "", ""])
      otpRefs.current[0]?.focus()
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
        const response = await fetch("/api/auth/setup-password", {
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
    } catch (error: any) {
      toast.error(error.message || "Failed to process request")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="from-background via-background to-muted/20 flex min-h-screen w-full items-center justify-center bg-gradient-to-br p-4 md:p-6">
      <div className="w-full max-w-lg">
        <div className="flex flex-col gap-8">
          {/* Header Section */}
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-20 items-center justify-center">
              <Image src={logoSrc} alt="ACOB Lighting" width={200} height={60} priority className="h-12 w-auto" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Set Up Your Account</h1>
            <p className="text-muted-foreground text-lg">Get started with ACOB ERP in just a few steps</p>
          </div>

          <Card className="border-2 shadow-xl">
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
                {isSuccess ? (
                  <>
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    Activation Complete
                  </>
                ) : token || isRecoveryMode ? (
                  <>
                    <Lock className="text-primary h-6 w-6" />
                    {isRecoveryMode ? "Reset Your Password" : "Create Your Password"}
                  </>
                ) : emailSent ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    Check Your Email
                  </>
                ) : (
                  <>
                    <UserPlus className="text-primary h-6 w-6" />
                    Activate Your Account
                  </>
                )}
              </CardTitle>
              <CardDescription className="text-base">
                {isSuccess
                  ? "Your account is now active"
                  : token || isRecoveryMode
                    ? isRecoveryMode
                      ? "Enter a new password for your account"
                      : "Set a secure password to activate your company account"
                    : emailSent
                      ? "We've sent you a link to set up your password"
                      : "Enter your company email and we'll send you a link to create your password"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              {isSuccess ? (
                <div className="space-y-6">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      You can now log in with your new password. Redirecting to login page...
                    </p>
                  </div>
                  <Link href="/auth/login" className="block">
                    <Button className="h-11 w-full">Go to Login</Button>
                  </Link>
                </div>
              ) : token || isRecoveryMode ? (
                <form onSubmit={handleCreatePassword}>
                  <div className="flex flex-col gap-5">
                    <div className="grid gap-3">
                      <Label htmlFor="password">New Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-11 pr-10"
                          autoFocus
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="h-11 pr-10"
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="h-11 w-full text-base font-semibold" loading={isLoading}>
                      Activate Account
                    </Button>
                  </div>
                </form>
              ) : emailSent ? (
                <div className="space-y-6">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                    <div className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                      <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                        <p className="font-medium">Setup code sent to {email}</p>
                        <p>
                          We sent a 6-digit verification code to your email. Enter it below, or click the link in the
                          email.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* OTP Input */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <KeyRound className="h-4 w-4" />
                        Verification Code
                      </Label>
                      <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                        {otpDigits.map((digit, i) => (
                          <input
                            key={i}
                            ref={(el) => {
                              otpRefs.current[i] = el
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(i, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                            className="border-input bg-background focus:ring-primary/20 h-14 w-12 rounded-lg border-2 text-center text-2xl font-bold transition-all focus:border-green-500 focus:ring-2 focus:outline-none"
                            autoFocus={i === 0}
                          />
                        ))}
                      </div>
                      <p className="text-muted-foreground text-center text-xs">
                        Check your inbox (and spam folder) for the code
                      </p>
                    </div>

                    <Button
                      onClick={handleVerifyOtp}
                      className="h-11 w-full text-base font-semibold"
                      disabled={otpDigits.join("").length !== 6 || isVerifyingOtp}
                    >
                      {isVerifyingOtp ? "Verifying..." : "Verify & Continue"}
                    </Button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background text-muted-foreground px-2">or click the link in the email</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => {
                        setEmailSent(false)
                        setOtpDigits(["", "", "", "", "", ""])
                      }}
                      variant="outline"
                      className="h-11 w-full"
                    >
                      Didn&apos;t receive it? Send again
                    </Button>
                    <Link href="/auth/login" className="block">
                      <Button variant="ghost" className="h-11 w-full">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Login
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSetupAccount}>
                  <div className="flex flex-col gap-5">
                    <div className="grid gap-3">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Company Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="a.john@org.acoblighting.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 text-base"
                        autoFocus
                      />
                      <p className="text-muted-foreground text-xs">
                        Use the email address your administrator registered you with
                      </p>
                    </div>

                    <Button type="submit" className="h-11 w-full text-base font-semibold" loading={isLoading}>
                      Send Setup Link
                    </Button>

                    <Link href="/auth/login" className="block">
                      <Button variant="ghost" className="h-11 w-full">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Login
                      </Button>
                    </Link>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Help Text */}
          <Card className="border bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <p className="mb-1 font-medium">Already have a password?</p>
                  <p>
                    If you&apos;ve already set up your account, go to the{" "}
                    <Link href="/auth/login" className="font-semibold underline underline-offset-4">
                      login page
                    </Link>{" "}
                    and sign in with your email and password.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function SetupAccountPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center font-medium">Loading setup page...</div>}
    >
      <SetupAccountContent />
    </Suspense>
  )
}
