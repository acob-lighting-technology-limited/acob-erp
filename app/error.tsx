"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/telemetry/client"
import { Button } from "@/components/ui/button"

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void reportClientError({
      source: "react.error_boundary",
      message: error?.message || "React route error boundary triggered",
      stack: error?.stack || null,
      route: typeof window !== "undefined" ? window.location.pathname : "/",
      context: { digest: error?.digest || null },
    })
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-semibold">Something went wrong on this page</h2>
      <p className="text-muted-foreground max-w-xl text-sm">
        The issue has been logged automatically. Please try again, and if it repeats, share the exact route.
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  )
}
