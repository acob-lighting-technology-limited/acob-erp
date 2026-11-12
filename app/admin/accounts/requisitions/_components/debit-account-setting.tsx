"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RowsSkeleton } from "@/components/skeletons"
import { apiFetch } from "@/lib/api-client"

/** Zenith Bank's code: ACOB's debit account is held there. */
const ZENITH_CODE = "057"

type Lookup =
  | { status: "loading" }
  | { status: "found"; accountName: string }
  | { status: "not_found" }
  | { status: "unavailable" }

/** The ACOB account the bank debits, written on every line of a payment schedule's bank file. */
export function DebitAccountSetting() {
  const [value, setValue] = useState("")
  const [saved, setSaved] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [lookup, setLookup] = useState<Lookup | null>(null)

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

  // Ask Paystack for the name on the account at Zenith, once ten digits are typed.
  useEffect(() => {
    if (value.length !== 10) {
      setLookup(null)
      return
    }
    let active = true
    setLookup({ status: "loading" })
    const timer = setTimeout(() => {
      apiFetch("/api/requisitions/resolve-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_number: value, bank_code: ZENITH_CODE }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (!active) return
          setLookup(json?.data?.status ? json.data : { status: "unavailable" })
        })
        .catch(() => active && setLookup({ status: "unavailable" }))
    }, 400)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [value])

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
          ACOB&rsquo;s Zenith Bank account on every line of a payment schedule&rsquo;s bank file. Schedules already made
          keep theirs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <RowsSkeleton rows={1} />
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                maxLength={10}
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
                aria-label="Debit account number"
                className="font-mono"
              />
              <Button
                onClick={save}
                disabled={busy || value.length !== 10 || value === saved || lookup?.status === "not_found"}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
            <DebitLookupLine lookup={lookup} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function DebitLookupLine({ lookup }: { lookup: Lookup | null }) {
  if (!lookup) return null
  if (lookup.status === "loading") {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the account with Zenith Bank…
      </p>
    )
  }
  if (lookup.status === "found") {
    return (
      <p className="text-success flex items-center gap-1.5 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Zenith Bank: {lookup.accountName}
      </p>
    )
  }
  if (lookup.status === "not_found") {
    return (
      <p className="text-danger flex items-center gap-1.5 text-xs" role="alert">
        <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> Zenith Bank has no account with this number. Check the
        digits.
      </p>
    )
  }
  return (
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> Could not reach the bank to check this account. You can still
      save it.
    </p>
  )
}
