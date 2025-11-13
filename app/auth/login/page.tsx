"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password")
  const [step, setStep] = useState<"credentials" | "otp">("credentials")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: undefined, // ✅ no redirect → OTP only
        },
      })
      if (error) throw error
      toast.success("OTP sent to your email!")
      setStep("otp")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      toast.success("Login successful!")
      router.push("/dashboard")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid email or password"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      })
      if (error) throw error
      toast.success("Login successful!")
      router.push("/dashboard")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid OTP"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="from-background via-background to-muted/20 flex min-h-screen w-full items-center justify-center bg-gradient-to-br p-4 md:p-6">
      <div className="w-full max-w-lg">
        <div className="flex flex-col gap-8">
          {/* Header Section */}
          <div className="space-y-2 text-center">
            <h1 className="text-4xl font-bold tracking-tight">Welcome Back</h1>
            <p className="text-muted-foreground text-lg">Login to access your ACOB staff portal</p>
          </div>

          <Card className="border-2 shadow-xl">
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className="text-2xl font-semibold">
                {step === "credentials" ? "Sign In" : "Verify OTP"}
              </CardTitle>
              <CardDescription className="text-base">
                {step === "credentials" ? "Choose your preferred login method" : "Enter the OTP sent to your email"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              {step === "credentials" ? (
                <div className="space-y-4">
                  {/* Login Method Tabs */}
                  <div className="bg-muted flex gap-2 rounded-lg p-1.5">
                    <button
                      type="button"
                      onClick={() => setLoginMethod("password")}
                      className={`flex-1 rounded-md px-6 py-3 text-sm font-semibold transition-all ${
                        loginMethod === "password"
                          ? "bg-background ring-primary/20 shadow-md ring-2"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      }`}
                    >
                      Password
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoginMethod("otp")}
                      className={`flex-1 rounded-md px-6 py-3 text-sm font-semibold transition-all ${
                        loginMethod === "otp"
                          ? "bg-background ring-primary/20 shadow-md ring-2"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      }`}
                    >
                      OTP
                    </button>
                  </div>

                  {/* Password Login Form */}
                  {loginMethod === "password" ? (
                    <form onSubmit={handlePasswordLogin}>
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
                          />
                        </div>
                        <div className="grid gap-3">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-sm font-medium">
                              Password
                            </Label>
                            <Link
                              href="/auth/forgot-password"
                              className="text-primary text-xs underline-offset-4 hover:underline"
                            >
                              Forgot password?
                            </Link>
                          </div>
                          <Input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-11 text-base"
                          />
                        </div>
                        {error && (
                          <p className="rounded-md bg-red-50 p-3 text-sm text-red-500 dark:bg-red-950/30">{error}</p>
                        )}
                        <Button type="submit" className="h-11 w-full text-base font-semibold" loading={isLoading}>
                          Login with Password
                        </Button>
                      </div>
                    </form>
                  ) : (
                    /* OTP Login Form */
                    <form onSubmit={handleRequestOTP}>
                      <div className="flex flex-col gap-5">
                        <div className="grid gap-3">
                          <Label htmlFor="email-otp" className="text-sm font-medium">
                            Company Email
                          </Label>
                          <Input
                            id="email-otp"
                            type="email"
                            placeholder="a.john@org.acoblighting.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-11 text-base"
                          />
                        </div>
                        {error && (
                          <p className="rounded-md bg-red-50 p-3 text-sm text-red-500 dark:bg-red-950/30">{error}</p>
                        )}
                        <Button type="submit" className="h-11 w-full text-base font-semibold" loading={isLoading}>
                          Request OTP
                        </Button>
                      </div>
                    </form>
                  )}

                  <div className="mt-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      Don&apos;t have an account?{" "}
                      <Link
                        href="/auth/sign-up"
                        className="text-primary font-semibold underline-offset-4 hover:underline"
                      >
                        Sign up
                      </Link>
                    </p>
                  </div>
                </div>
              ) : (
                /* OTP Verification Form */
                <form onSubmit={handleVerifyOTP}>
                  <div className="flex flex-col gap-6">
                    <div className="grid gap-3">
                      <Label htmlFor="otp" className="text-sm font-medium">
                        One-Time Password
                      </Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        className="h-11 text-center font-mono text-2xl text-base tracking-widest"
                      />
                    </div>
                    {error && (
                      <p className="rounded-md bg-red-50 p-3 text-sm text-red-500 dark:bg-red-950/30">{error}</p>
                    )}
                    <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={isLoading}>
                      {isLoading ? "Verifying..." : "Verify OTP"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setStep("credentials")
                        setOtp("")
                        setError(null)
                      }}
                      className="h-11 w-full text-base"
                    >
                      Back to Login
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
