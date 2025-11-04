"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Lock, CheckCircle } from "lucide-react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Check if user has a valid session from the reset link
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        toast.error("Invalid or expired reset link. Please request a new one.")
        router.push("/auth/forgot-password")
      }
    }
    
    checkSession()
  }, [router])

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
    <div className="flex min-h-screen w-full items-center justify-center p-4 md:p-6 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="w-full max-w-lg">
        <div className="flex flex-col gap-8">
          {/* Header Section */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Reset Password</h1>
            <p className="text-muted-foreground text-lg">
              Enter your new password below
            </p>
          </div>

          <Card className="border-2 shadow-xl">
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                {isSuccess ? (
                  <>
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    Password Reset Complete
                  </>
                ) : (
                  <>
                    <Lock className="h-6 w-6 text-primary" />
                    Create New Password
                  </>
                )}
              </CardTitle>
              <CardDescription className="text-base">
                {isSuccess 
                  ? "Your password has been successfully reset" 
                  : "Choose a strong password for your account"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              {isSuccess ? (
                <div className="space-y-6">
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      You can now log in with your new password. Redirecting to login page...
                    </p>
                  </div>
                  <Link href="/auth/login" className="block">
                    <Button className="w-full h-11">
                      Go to Login
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleResetPassword}>
                  <div className="flex flex-col gap-5">
                    <div className="grid gap-3">
                      <Label htmlFor="password" className="text-sm font-medium">
                        New Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter new password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 text-base"
                        autoFocus
                        minLength={6}
                      />
                      <p className="text-xs text-muted-foreground">
                        Must be at least 6 characters long
                      </p>
                    </div>

                    <div className="grid gap-3">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium">
                        Confirm New Password
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm new password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-11 text-base"
                        minLength={6}
                      />
                    </div>

                    {error && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                      </div>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full h-11 text-base font-semibold" 
                      disabled={isLoading}
                    >
                      {isLoading ? "Resetting Password..." : "Reset Password"}
                    </Button>

                    <Link href="/auth/login" className="block">
                      <Button variant="ghost" className="w-full h-11">
                        Cancel
                      </Button>
                    </Link>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Security Tips */}
          {!isSuccess && (
            <Card className="border bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-medium mb-1">Password Tips</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Use a mix of letters, numbers, and symbols</li>
                      <li>Avoid common words or personal information</li>
                      <li>Make it at least 6 characters long</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

