"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RowsSkeleton } from "@/components/skeletons"
import { apiFetch } from "@/lib/api-client"

/** The ACOB account the bank debits, written on every line of a payment schedule's bank file. */
export function DebitAccountSetting() {
  const [value, setValue] = useState("")
  const [saved, setSaved] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    apiFetch("/api/requisitions/settings")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return
        const account = json?.data?.bank_debit_account || ""
        setValue(account)
        setSaved(account)
      })
      .catch(() => toast.error("Could not load the debit account"))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [])

  const save = async () => {
    setBusy(true)
    try {
      const res = await apiFetch("/api/requisitions/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank_debit_account: value }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not save")
      setSaved(value)
      toast.success("Debit account saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Account the bank debits</CardTitle>
        <CardDescription>
          ACOB&rsquo;s account on every line of a payment schedule&rsquo;s bank file. Schedules already made keep
          theirs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <RowsSkeleton rows={1} />
        ) : (
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              maxLength={10}
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
              aria-label="Debit account number"
              className="font-mono"
            />
            <Button onClick={save} disabled={busy || value.length !== 10 || value === saved}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
