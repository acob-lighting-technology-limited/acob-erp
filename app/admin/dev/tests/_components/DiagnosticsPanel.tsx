"use client"

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { CheckCircle, Loader2, ScanSearch, ShieldAlert, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"

export interface DiagnosticRowBase {
  resolved: boolean
  resolved_user_id?: string | null
  resolved_name?: string | null
  fail_reason?: string
}

interface DiagnosticsResponse<Row> {
  results: Row[]
  broken_count: number
  total: number
}

interface DiagnosticsPanelProps<Row extends DiagnosticRowBase> {
  title: string
  description: string
  endpoint: string
  /** Noun for the summary line, e.g. "stage" or "check". */
  unit: string
  okToast: string
  failToast: (brokenCount: number) => string
  rowLabel: (row: Row) => ReactNode
  fixHint?: (row: Row) => string | undefined
  /** Group rows under headings (e.g. by requester kind). Omit for a flat list. */
  groupBy?: (row: Row) => string
  groupLabel?: (key: string) => string
}

/**
 * Runs a route-diagnostics endpoint and lists every check as resolved or broken,
 * with the fix hint for broken ones. Shared by the Leave, Help Desk and Task tabs.
 */
export function DiagnosticsPanel<Row extends DiagnosticRowBase>({
  title,
  description,
  endpoint,
  unit,
  okToast,
  failToast,
  rowLabel,
  fixHint,
  groupBy,
  groupLabel = (key) => key.replace(/_/g, " "),
}: DiagnosticsPanelProps<Row>) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagnosticsResponse<Row> | null>(null)

  const run = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await apiFetch(endpoint)
      const data = (await res.json()) as DiagnosticsResponse<Row>
      setResult(data)
      if (data.broken_count === 0) toast.success(okToast)
      else toast.error(failToast(data.broken_count))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  const rows = result?.results ?? []
  const groups: Array<[string | null, Row[]]> = groupBy
    ? Object.entries(
        rows.reduce<Record<string, Row[]>>((acc, row) => {
          const key = groupBy(row)
          ;(acc[key] ||= []).push(row)
          return acc
        }, {})
      )
    : [[null, rows]]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanSearch className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={run} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            {loading ? "Checking…" : "Check All Routes"}
          </Button>
          {result && (
            <span className={cn("text-sm font-medium", result.broken_count === 0 ? "text-green-600" : "text-red-500")}>
              {result.broken_count === 0
                ? `✓ All ${result.total} ${unit}(s) OK`
                : `✗ ${result.broken_count} / ${result.total} broken`}
            </span>
          )}
        </div>

        {rows.length > 0 && (
          <div className="space-y-4">
            {groups.map(([key, groupRows]) => {
              const broken = groupRows.filter((row) => !row.resolved).length
              return (
                <div key={key ?? "all"}>
                  {key !== null && (
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-semibold capitalize">{groupLabel(key)}</span>
                      <Badge variant={broken > 0 ? "destructive" : "default"} className="text-xs">
                        {broken > 0 ? `${broken} broken` : "OK"}
                      </Badge>
                    </div>
                  )}
                  <div className="space-y-1">
                    {groupRows.map((row, i) => {
                      const hint = row.resolved ? undefined : fixHint?.(row)
                      return (
                        <div
                          key={i}
                          className={cn(
                            "rounded-md border px-3 py-2 text-xs",
                            row.resolved ? "border-success/30 bg-success/15" : "border-danger/30 bg-danger/15"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {row.resolved ? (
                              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                            ) : (
                              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="font-mono font-medium">{rowLabel(row)}</span>
                              {row.resolved ? (
                                row.resolved_name || row.resolved_user_id ? (
                                  <span className="text-muted-foreground ml-2">
                                    → {row.resolved_name || row.resolved_user_id}
                                  </span>
                                ) : null
                              ) : (
                                <div className="mt-1 space-y-1">
                                  <p className="text-red-500">{row.fail_reason}</p>
                                  {hint && (
                                    <p className="text-warning">
                                      <strong>Fix:</strong> {hint}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
