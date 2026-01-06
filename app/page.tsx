"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertCircle, Lock, Wrench } from "lucide-react"
import Image from "next/image"

interface SystemStatus {
  shutdownMode: {
    enabled: boolean
    title?: string
    message?: string
  }
  maintenanceMode: {
    enabled: boolean
    title?: string
    message?: string
    estimated_end?: string | null
  }
}

export default function StatusPage() {
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [logoClicks, setLogoClicks] = useState(0)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const searchParams = useSearchParams()
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch system status and redirect if no modes are active
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/system-status")
        if (response.ok) {
          const data = await response.json()
          setSystemStatus(data)

          // If neither mode is enabled, redirect to the profile page directly
          if (!data.shutdownMode?.enabled && !data.maintenanceMode?.enabled) {
            // Use router.replace for smoother transition
            router.replace("/profile")
            return
          }
        }
      } catch (error) {
        console.error("Error fetching system status:", error)
        // On error, redirect to profile (will handle auth there)
        router.replace("/profile")
        return
      } finally {
        setCheckingStatus(false)
      }
    }
    fetchStatus()
  }, [router])

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
    console.log("=== FRONTEND: FORM SUBMISSION STARTED ===")

    setError("")
    setLoading(true)

    try {
      console.log("1. Form submitted")
      console.log("2. Password provided:", password ? `Yes (${password.length} chars)` : "No")

      const requestBody = { password }
      console.log("3. Request body:", { hasPassword: !!password, passwordLength: password?.length })

      console.log("4. Sending POST request to /api/shutdown-access...")

      const response = await fetch("/api/shutdown-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      console.log("5. Response received")
      console.log("   - Status:", response.status)
      console.log("   - Status Text:", response.statusText)
      console.log("   - OK:", response.ok)
      console.log("   - Headers:", Object.fromEntries(response.headers.entries()))

      // Clone the response so we can read it multiple times if needed
      const responseClone = response.clone()

      let data
      try {
        data = await response.json()
        console.log("6. Response data parsed:", data)
      } catch (jsonError) {
        console.error("7. ERROR: Failed to parse JSON response:", jsonError)
        // Use the cloned response to get text
        const responseText = await responseClone.text()
        console.log("   Response text:", responseText)
        throw new Error("Invalid JSON response from server")
      }

      if (response.ok) {
        console.log("8. SUCCESS: Access granted")
        console.log("9. Redirecting to /dashboard...")
        // Redirect to dashboard or home
        router.push("/dashboard")
        router.refresh()
        console.log("10. Redirect initiated")
      } else {
        console.log("8. FAILURE: Access denied")
        console.log("   - Error:", data.error)
        console.log("   - Details:", data.details)
        console.log("   - Type:", data.type)
        setError(data.error || "Invalid password")
        setPassword("")
      }
    } catch (err) {
      console.error("=== FRONTEND: ERROR CAUGHT ===")
      console.error("Error type:", err?.constructor?.name)
      console.error("Error message:", err instanceof Error ? err.message : String(err))
      console.error("Error stack:", err instanceof Error ? err.stack : "No stack trace")
      console.error("Full error:", err)

      setError(`An error occurred: ${err instanceof Error ? err.message : "Please try again."}`)
      setPassword("")
    } finally {
      setLoading(false)
      console.log("=== FRONTEND: FORM SUBMISSION ENDED ===")
    }
  }

  // Determine which mode is active
  const isShutdownMode = systemStatus?.shutdownMode?.enabled
  const isMaintenanceMode = systemStatus?.maintenanceMode?.enabled && !isShutdownMode

  // Get display content
  const displayTitle = isShutdownMode
    ? systemStatus?.shutdownMode?.title || "Service Discontinued"
    : isMaintenanceMode
      ? systemStatus?.maintenanceMode?.title || "Maintenance Mode"
      : "Service Unavailable"

  const displayMessage = isShutdownMode
    ? systemStatus?.shutdownMode?.message || "This service has been discontinued."
    : isMaintenanceMode
      ? systemStatus?.maintenanceMode?.message || "We are currently performing scheduled maintenance."
      : "The service is temporarily unavailable."

  const displayIcon = isMaintenanceMode ? Wrench : AlertCircle
  const iconColor = isMaintenanceMode ? "text-orange-600" : "text-destructive"
  const iconBgColor = isMaintenanceMode ? "bg-orange-100 dark:bg-orange-900/30" : "bg-destructive/10"

  const Icon = displayIcon

  // Show minimal loading while checking status (will redirect if modes are off)
  if (checkingStatus) {
    return (
      <div className="bg-background flex min-h-screen w-full items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-screen w-full items-center justify-center p-6">
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
            <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${iconBgColor}`}>
              <Icon className={`h-8 w-8 ${iconColor}`} />
            </div>
            <CardTitle className="text-4xl">{displayTitle}</CardTitle>
            <CardDescription className="mt-4 text-xl">{displayMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            {isMaintenanceMode && systemStatus?.maintenanceMode?.estimated_end && (
              <p className="text-muted-foreground mb-4 text-center text-base">
                Estimated completion: {new Date(systemStatus.maintenanceMode.estimated_end).toLocaleString()}
              </p>
            )}
            {isShutdownMode && (
              <>
                <p className="text-muted-foreground text-center text-lg">Thank you for your support.</p>
                <p className="text-muted-foreground mt-2 text-center text-base">Best regards, Chibuikem</p>
              </>
            )}

            {/* Password Form - Hidden until triggered */}
            {showPasswordForm && (
              <div className="mt-8 space-y-4 border-t pt-6">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
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
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
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
