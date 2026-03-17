"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, AlertCircle } from "lucide-react"

interface SendResultItem {
  to: string
  success: boolean
}

interface SendResultPanelProps {
  results: SendResultItem[]
}

export function SendResultPanel({ results }: SendResultPanelProps) {
  if (!results || results.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Send Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[300px] space-y-1 overflow-y-auto">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
                r.success ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
              }`}
            >
              <span className="truncate">{r.to}</span>
              {r.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
