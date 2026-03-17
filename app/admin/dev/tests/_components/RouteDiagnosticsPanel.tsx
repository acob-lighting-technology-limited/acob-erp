"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ShieldAlert, ScanSearch, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DiagnosticsResult } from "./shared-types"
import { FIX_HINTS } from "./shared-types"

export function RouteDiagnosticsPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagnosticsResult | null>(null)

  const run = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/dev/leave-route-diagnostics")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: DiagnosticsResult = await res.json()
      setResult(data)
      if (data.broken_count === 0) {
        toast.success("All routes fully configured ✓")
      } else {
        toast.error(`${data.broken_count} broken stage(s) found`)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  const byKind = result
    ? (result.results || []).reduce<Record<string, typeof result.results>>((acc, r) => {
        acc[r.requester_kind] = acc[r.requester_kind] || []
        acc[r.requester_kind].push(r)
        return acc
      }, {})
    : {}

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanSearch className="h-4 w-4" />
          Leave Route Diagnostics
        </CardTitle>
        <CardDescription>
          Validates every approval stage in the DB. Run this to spot missing approver assignments before running the
          flow test.
        </CardDescription>
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
                ? `✓ All ${result.total} stage(s) OK`
                : `✗ ${result.broken_count} / ${result.total} broken`}
            </span>
          )}
        </div>

        {result && Object.keys(byKind).length > 0 && (
          <div className="space-y-4">
            {Object.entries(byKind).map(([kind, rows]) => {
              const broken = rows.filter((r) => !r.resolved)
              return (
                <div key={kind}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold capitalize">{kind.replace(/_/g, " ")}</span>
                    <Badge variant={broken.length > 0 ? "destructive" : "default"} className="text-xs">
                      {broken.length > 0 ? `${broken.length} broken` : "OK"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {rows.map((row, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-md border px-3 py-2 text-xs",
                          row.resolved
                            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                            : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {row.resolved ? (
                            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                          ) : (
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="font-mono font-medium">
                              Stage {row.stage_order}: {row.approver_role_code}
                            </span>
                            {row.resolved ? (
                              <span className="text-muted-foreground ml-2">
                                → {row.resolved_name || row.resolved_user_id}
                              </span>
                            ) : (
                              <div className="mt-1 space-y-1">
                                <p className="text-red-600 dark:text-red-400">{row.fail_reason}</p>
                                {FIX_HINTS[row.approver_role_code] && (
                                  <p className="text-amber-700 dark:text-amber-400">
                                    <strong>Fix:</strong> {FIX_HINTS[row.approver_role_code]}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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
