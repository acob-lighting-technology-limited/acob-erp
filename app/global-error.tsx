"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/telemetry/client"
import { Button } from "@/components/ui/button"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void reportClientError({
      source: "react.global_error_boundary",
      message: error?.message || "React global error boundary triggered",
      stack: error?.stack || null,
      route: typeof window !== "undefined" ? window.location.pathname : "/",
      context: { digest: error?.digest || null },
    })
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-xl font-semibold">Critical UI Error</h2>
          <p className="text-muted-foreground max-w-xl text-sm">
            A critical UI failure occurred and has been logged. Please retry.
          </p>
          <Button onClick={reset}>Retry App</Button>
        </div>
      </body>
    </html>
  )
}
