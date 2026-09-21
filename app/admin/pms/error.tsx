"use client"

import { ShellErrorBoundary } from "@/components/shell-error-boundary"

export default function PmsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ShellErrorBoundary
      error={error}
      reset={reset}
      shell="admin"
      title="Unable to load performance data"
      description="Something went wrong while fetching PMS data. This is usually temporary."
    />
  )
}
