"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState, useEffect } from "react"

import { toast } from "sonner"
import { ArrowLeft, UserPlus, CheckCircle2 } from "lucide-react"
import Image from "next/image"
import { useTheme } from "next-themes"

export default function SetupAccountPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()

  // Default to light logo for SSR to prevent hydration mismatch
  const logoSrc = !mounted
    ? "/images/acob-logo-light.webp"
    : resolvedTheme === "dark"
      ? "/images/acob-logo-dark.webp"
      : "/images/acob-logo-light.webp"

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSetupAccount = async (e: React.FormEvent) => {
    e.preventDefault()

    // Domain restriction check
    const allowedDomains = ["acoblighting.com", "org.acoblighting.com"]
    const domain = email.split("@")[1]?.toLowerCase()
    if (!domain || !allowedDomains.includes(domain)) {
      toast.error("Only @acoblighting.com and @org.acoblighting.com emails are allowed.")
      return
    }

    const supabase = createClient()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
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
                {emailSent ? (
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
                {emailSent
                  ? "We've sent you a link to set up your password"
                  : "Enter your company email and we'll send you a link to create your password"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              {emailSent ? (
                <div className="space-y-6">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                    <div className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                      <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                        <p className="font-medium">Setup link sent to {email}</p>
                        <p>
                          Open the email and click the link to create your password. If you don&apos;t see it, check
                          your spam folder.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Steps indicator */}
                  <div className="space-y-3 rounded-lg border p-4">
                    <p className="text-sm font-medium">What to do next:</p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <span className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                          1
                        </span>
                        <p className="text-muted-foreground text-sm">Open the email we just sent you</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                          2
                        </span>
                        <p className="text-muted-foreground text-sm">
                          Click the <strong>&quot;Reset Password&quot;</strong> button in the email
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                          3
                        </span>
                        <p className="text-muted-foreground text-sm">Create your password and start using ACOB ERP</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button onClick={() => setEmailSent(false)} variant="outline" className="h-11 w-full">
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
