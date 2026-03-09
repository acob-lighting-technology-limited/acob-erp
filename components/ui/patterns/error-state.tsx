import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  title?: string
  description?: string
  retryAction?: React.ReactNode
  className?: string
}

export function ErrorState({
  title = "Something went wrong",
  description = "Please try again. If the issue persists, contact support.",
  retryAction,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("rounded-lg border border-red-200 bg-red-50 p-4 sm:p-6", className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-800">{title}</p>
          <p className="mt-1 text-sm text-red-700">{description}</p>
          {retryAction ? <div className="mt-3">{retryAction}</div> : null}
        </div>
      </div>
    </div>
  )
}
