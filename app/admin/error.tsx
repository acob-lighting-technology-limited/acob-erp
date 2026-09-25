"use client"

import { ShellErrorBoundary } from "@/components/shell-error-boundary"

export default function AdminShellError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ShellErrorBoundary error={error} reset={reset} shell="admin" />
}
