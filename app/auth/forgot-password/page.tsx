"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
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
    <div className="flex min-h-screen w-full items-center justify-center p-4 md:p-6 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="w-full max-w-lg">
        <div className="flex flex-col gap-8">
          {/* Header Section */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Forgot Password</h1>
            <p className="text-muted-foreground text-lg">
              Enter your email to receive a password reset link
            </p>
          </div>

          <Card className="border-2 shadow-xl">
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                <Mail className="h-6 w-6 text-primary" />
                Reset Your Password
              </CardTitle>
              <CardDescription className="text-base">
                {emailSent 
                  ? "We've sent you a password reset link" 
                  : "We'll send you instructions to reset your password"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              {emailSent ? (
                <div className="space-y-6">
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Check your email inbox for a password reset link. If you don't see it, check your spam folder.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Button
                      onClick={() => setEmailSent(false)}
                      variant="outline"
                      className="w-full h-11"
                    >
                      Send Another Email
                    </Button>
                    <Link href="/auth/login" className="block">
                      <Button variant="ghost" className="w-full h-11">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Login
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleResetPassword}>
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
                      <p className="text-xs text-muted-foreground">
                        Enter the email address associated with your account
                      </p>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-11 text-base font-semibold" 
                      disabled={isLoading}
                    >
                      {isLoading ? "Sending..." : "Send Reset Link"}
                    </Button>

                    <Link href="/auth/login" className="block">
                      <Button variant="ghost" className="w-full h-11">
                        <ArrowLeft className="h-4 w-4 mr-2" />
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
                  <p className="font-medium mb-1">Need help?</p>
                  <p>
                    If you're having trouble resetting your password, please contact your system administrator or IT support.
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

