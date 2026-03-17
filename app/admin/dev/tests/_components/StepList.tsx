"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, SkipForward } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StepResult, TestResult } from "./shared-types"

export function StepList({ steps }: { steps: StepResult[] }) {
  if (!steps.length) return null
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-3 rounded-md border px-3 py-2 text-sm",
            step.status === "ok" && "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
            step.status === "error" && "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
            step.status === "skipped" && "bg-muted/40 border-dashed"
          )}
        >
          <div className="mt-0.5 shrink-0">
            {step.status === "ok" && <CheckCircle className="h-4 w-4 text-green-600" />}
            {step.status === "error" && <XCircle className="h-4 w-4 text-red-500" />}
            {step.status === "skipped" && <SkipForward className="text-muted-foreground h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <code className="text-xs font-medium">{step.step}</code>
              <Badge
                variant={step.status === "ok" ? "default" : step.status === "error" ? "destructive" : "secondary"}
                className="text-xs"
              >
                {step.status}
              </Badge>
            </div>
            {step.detail && <p className="text-muted-foreground mt-0.5 text-xs">{step.detail}</p>}
            {step.data !== undefined && (
              <pre className="bg-muted mt-1 max-h-36 overflow-auto rounded p-2 text-xs">
                {JSON.stringify(step.data as Record<string, unknown>, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ResultCard({ result }: { result: TestResult }) {
  const pass = result.steps.filter((s) => s.status === "ok").length
  const fail = result.steps.filter((s) => s.status === "error").length
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {result.ok ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
          {result.ok ? "All Stages Passed" : "Flow Failed"}
          <span className="text-muted-foreground ml-auto flex gap-3 text-sm font-normal">
            <span className="text-green-600">{pass} passed</span>
            <span className="text-red-500">{fail} failed</span>
          </span>
        </CardTitle>
        {result.error && <p className="text-destructive text-sm">{result.error}</p>}
      </CardHeader>
      <CardContent>
        <StepList steps={result.steps} />
      </CardContent>
    </Card>
  )
}
