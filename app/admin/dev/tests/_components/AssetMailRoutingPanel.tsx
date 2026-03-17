"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ShieldAlert, Package } from "lucide-react"
import type { AssetMailRoutingResult } from "./shared-types"

export function AssetMailRoutingPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AssetMailRoutingResult | null>(null)

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/dev/asset-mail-routing")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load asset mail routing")
      setResult(data as AssetMailRoutingResult)
      toast.success("Asset mail routing loaded")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" />
          Asset Mail Routing
        </CardTitle>
        <CardDescription>
          Shows the live employee-to-recipient mapping used for the five asset mail types.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={run} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            {loading ? "Loading…" : "Load Live Matrix"}
          </Button>
          {result && (
            <span className="text-sm font-medium text-green-600">
              {result.total} active employees | HCS: {result.hcs?.name || "Not found"} | MD:{" "}
              {result.md?.name || "Not found"}
            </span>
          )}
        </div>

        {result && (
          <div className="space-y-3">
            <div className="text-muted-foreground text-xs">
              Asset mails covered: Asset Officially Assigned, Asset Transfer Initiated, Asset Transfer Received, Asset
              Officially Returned, Asset Status Alert
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="border px-3 py-2 text-left">Employee</th>
                    <th className="border px-3 py-2 text-left">Department</th>
                    <th className="border px-3 py-2 text-left">Routing Class</th>
                    <th className="border px-3 py-2 text-left">Recipients For All 5 Asset Mails</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.employee_id} className="odd:bg-background even:bg-muted/20">
                      <td className="border px-3 py-2">{row.employee_name}</td>
                      <td className="border px-3 py-2">{row.department}</td>
                      <td className="border px-3 py-2">{row.routing_class}</td>
                      <td className="border px-3 py-2">{row.recipients.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
