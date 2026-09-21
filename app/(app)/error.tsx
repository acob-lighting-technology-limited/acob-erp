"use client"

import { ShellErrorBoundary } from "@/components/shell-error-boundary"

export default function StaffShellError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ShellErrorBoundary error={error} reset={reset} shell="staff" />
}
