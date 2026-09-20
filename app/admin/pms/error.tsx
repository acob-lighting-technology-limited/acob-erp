"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function AdminPmsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Admin PMS Error]", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <div>
            <h2 className="text-lg font-semibold">Unable to load PMS admin data</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Something went wrong while loading the performance management view. This is usually temporary.
            </p>
            {error.digest && <p className="text-muted-foreground mt-2 font-mono text-xs">Ref: {error.digest}</p>}
          </div>
          <Button onClick={reset} className="gap-2" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
