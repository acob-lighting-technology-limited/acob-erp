"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertCircle, Lock } from "lucide-react"
import Image from "next/image"

export default function ShutdownPage() {
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [logoClicks, setLogoClicks] = useState(0)
  const searchParams = useSearchParams()
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check for ?admin=1 query parameter
  useEffect(() => {
    if (searchParams.get("admin") === "1") {
      setShowPasswordForm(true)
    }
  }, [searchParams])

  // Handle logo click - 4 clicks to reveal password form
  const handleLogoClick = () => {
    const newClicks = logoClicks + 1
    setLogoClicks(newClicks)
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    if (newClicks >= 4) {
      setShowPasswordForm(true)
      setLogoClicks(0) // Reset counter
    } else {
      // Reset counter after 2 seconds if not reached 4
      timeoutRef.current = setTimeout(() => {
        setLogoClicks(0)
      }, 2000)
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/shutdown-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      })

      const data = await response.json()

      if (response.ok) {
        // Redirect to dashboard or home
        router.push("/dashboard")
        router.refresh()
      } else {
        setError(data.error || "Invalid password")
        setPassword("")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
      setPassword("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Logo - clickable for bypass */}
        <div className="flex justify-center">
          <button
            onClick={handleLogoClick}
            className="cursor-pointer transition-opacity hover:opacity-80"
            aria-label="Logo"
          >
            <Image
              src="/acob-logo-light.webp"
              alt="ACOB Logo"
              width={200}
              height={80}
              className="dark:hidden"
              priority
            />
            <Image
              src="/acob-logo-dark.webp"
              alt="ACOB Logo"
              width={200}
              height={80}
              className="hidden dark:block"
              priority
            />
          </button>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-4xl">Service Discontinued</CardTitle>
            <CardDescription className="text-xl mt-4">
              This service has been discontinued as of December 2, {new Date().getFullYear()}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center text-lg">
              Thank you for your support.
            </p>
            <p className="text-muted-foreground text-center text-base mt-2">
            Best regards, Chibuikem
            </p>

            {/* Password Form - Hidden until triggered */}
            {showPasswordForm && (
              <div className="mt-8 space-y-4 border-t pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>Administrative Access</span>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Input
                      type="password"
                      placeholder="Enter access password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  {error && (
                    <p className="text-destructive text-sm">{error}</p>
                  )}
                  <Button type="submit" className="w-full" loading={loading} disabled={loading}>
                    {loading ? "Verifying..." : "Access Website"}
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
