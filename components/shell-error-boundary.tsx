"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { reportClientError } from "@/lib/telemetry/client"

/**
 * Shared body for a shell-level error.tsx.
 *
 * Placed inside a shell segment rather than at the app root, so a thrown
 * render keeps the sidebar and the viewer keeps their bearings — the root
 * boundary replaces the whole page and loses that.
 *
 * It also reports to /api/telemetry/errors, which is what feeds
 * Developer -> UI Errors. A boundary that only writes to console.error looks
 * like it is handling the failure while leaving no trace anyone can act on.
 */
export function ShellErrorBoundary({
  error,
  reset,
  shell,
  title = "Something went wrong",
  description = "This page failed to load. It is usually temporary — try again, and if it keeps happening the error has been recorded for the developers.",
}: {
  error: Error & { digest?: string }
  reset: () => void
  /** Names the surface in telemetry, e.g. "staff" | "admin" | "dept". */
  shell: string
  title?: string
  description?: string
}) {
  const isChunkError =
    /loading chunk .* failed/i.test(error?.message || "") ||
    /failed to fetch dynamically imported module/i.test(error?.message || "") ||
    /error loading dynamically imported module/i.test(error?.message || "")

  useEffect(() => {
    void reportClientError({
      source: "react.error_boundary",
      message: error.message || "Unknown render error",
      stack: error.stack ?? null,
      context: { shell, digest: error.digest, isChunkError },
    })
    if (isChunkError && typeof window !== "undefined") {
      try {
        const lastReload = sessionStorage.getItem("chunk_reload_boundary_ts")
        const now = Date.now()
        if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
          sessionStorage.setItem("chunk_reload_boundary_ts", now.toString())
          window.location.reload()
          return
        }
      } catch {
        // Ignore sessionStorage failure in private browsing mode
      }
    }

    void reportClientError({
      source: "react.error_boundary",
      message: error.message || "Unknown render error",
      stack: error.stack ?? null,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      // digest is the only handle on a server-component error, whose real
      // message is withheld from the browser in production.
      context: { shell, digest: error.digest, isChunkError },
    })
  }, [error, shell, isChunkError])

  const handleAction = () => {
    if (isChunkError && typeof window !== "undefined") {
      window.location.reload()
      return
    }
    reset()
  }

  const displayTitle = isChunkError ? "App updated" : title
  const displayDescription = isChunkError
    ? "A new version of the app was recently deployed. Please reload the page to load the latest version."
    : description

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <div>
            <h2 className="text-lg font-semibold">{displayTitle}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{displayDescription}</p>
            {error.digest && !isChunkError && (
              <p className="text-muted-foreground mt-2 font-mono text-xs">Reference: {error.digest}</p>
            )}
          </div>
          <Button onClick={handleAction} className="gap-2" variant="outline">
            <RefreshCw className="h-4 w-4" />
            {isChunkError ? "Reload page" : "Try again"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
