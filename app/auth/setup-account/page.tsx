"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthShell, authCardClassName } from "@/components/auth/auth-shell"
import { AuthNotice, AuthPasswordField } from "@/components/auth/auth-form-parts"
import Link from "next/link"
import { useState, Suspense } from "react"

import { Lock } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { AuthPageSkeleton } from "@/components/skeletons"

import { apiFetch } from "@/lib/api-client"

function SetupAccountContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams?.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (password.length < 12) {
      toast.error("Password must be at least 12 characters")
      return
    }

    setIsLoading(true)
    try {
      if (!token) throw new Error("This activation link is missing or invalid. Please contact HR.")

      const response = await apiFetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || "Failed to activate account")

      setIsSuccess(true)
      toast.success("Account activated successfully!")

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
        "Use the secure activation link in your onboarding email.",
        "Set a Matrix password that only you know.",
        "Create a strong password to activate your account.",
      ]}
    >
      <Card className={authCardClassName}>
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {isSuccess ? "Account activated" : token ? "Create your Matrix password" : "Activation link required"}
          </CardTitle>
          <CardDescription className="text-sm">
            {isSuccess
              ? "Your account is now active. Redirecting to login..."
              : token
                ? "Create a secure password to activate your Matrix account."
                : "Open the secure activation link sent with your onboarding instructions."}
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
          ) : token ? (
            <form onSubmit={handleCreatePassword} className="space-y-5">
              <AuthPasswordField
                id="password"
                label="New password"
                icon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                minLength={12}
                autoComplete="new-password"
                placeholder="At least 12 characters"
              />
              <AuthPasswordField
                id="confirmPassword"
                label="Confirm password"
                icon={Lock}
                revealLabel="password confirmation"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
                placeholder="Repeat your password"
              />
              <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" loading={isLoading}>
                Activate account
              </Button>
            </form>
          ) : (
            <AuthNotice>
              For your security, Matrix activation links are issued only with your onboarding email. Contact HR or ICT
              Support if you need a new link.
            </AuthNotice>
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
