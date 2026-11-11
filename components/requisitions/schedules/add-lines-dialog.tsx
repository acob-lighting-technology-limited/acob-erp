"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { CircleAlert, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { RowsSkeleton } from "@/components/skeletons"
import { apiFetch, apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatNaira } from "@/lib/requisitions/format"
import { NIGERIAN_BANKS } from "@/lib/requisitions/nuban"
import type { SchedulableLine } from "@/lib/requisitions/types"

const BANK_OPTIONS = NIGERIAN_BANKS.map((b) => ({ value: b.code, label: b.name }))

const lineKey = (l: Pick<SchedulableLine, "requisition_id" | "beneficiary_index">) =>
  `${l.requisition_id}:${l.beneficiary_index}`

interface Picked {
  amount: string
  bank_code: string
}

/** Pick verified Payment Request lines to put on a draft schedule. */
export function AddLinesDialog({
  open,
  onOpenChange,
  scheduleId,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  onAdded: () => void
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.requisitionSchedulePool(),
    queryFn: () => apiJson<{ data: SchedulableLine[] }>("/api/requisitions/schedules/pool"),
    enabled: open,
  })
  const lines = useMemo(() => data?.data || [], [data])
  const [picked, setPicked] = useState<Record<string, Picked>>({})
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setPicked({})
      setQuery("")
      void refetch()
    }
  }, [open, refetch])

  const shown = lines.filter((l) =>
    [l.requisition_number, l.account_name, l.requester_name, l.department, l.purpose]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(query.toLowerCase()))
  )

  const toggle = (line: SchedulableLine, on: boolean) =>
    setPicked((prev) => {
      const next = { ...prev }
      if (on)
        next[lineKey(line)] = {
          amount: line.amount != null ? String(line.amount) : "",
          bank_code: line.bank_code || "",
        }
      else delete next[lineKey(line)]
      return next
    })

  const update = (line: SchedulableLine, patch: Partial<Picked>) =>
    setPicked((prev) => ({ ...prev, [lineKey(line)]: { ...prev[lineKey(line)], ...patch } }))

  const chosen = lines.filter((l) => picked[lineKey(l)])
  const total = chosen.reduce((sum, l) => sum + (Number(picked[lineKey(l)].amount) || 0), 0)

  const submit = async () => {
    for (const l of chosen) {
      const p = picked[lineKey(l)]
      if (!(Number(p.amount) > 0))
        return toast.error(`Enter the amount for ${l.account_name} (${l.requisition_number})`)
      if (!p.bank_code) return toast.error(`Pick the bank for ${l.account_name} (${l.requisition_number})`)
    }
    setBusy(true)
    try {
      const res = await apiFetch(`/api/requisitions/schedules/${scheduleId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: chosen.map((l) => ({
            requisition_id: l.requisition_id,
            beneficiary_index: l.beneficiary_index,
            amount: Number(picked[lineKey(l)].amount),
            ...(l.bank_code ? {} : { bank_code: picked[lineKey(l)].bank_code }),
          })),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not add the payments")
      toast.success(`${chosen.length} payment${chosen.length === 1 ? "" : "s"} added`)
      onOpenChange(false)
      onAdded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the payments")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add payments</DialogTitle>
          <DialogDescription>
            Verified Payment Requests not yet paid. Each beneficiary is its own line in the bank file.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search reference, name, department…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {isLoading ? (
            <RowsSkeleton rows={4} />
          ) : error ? (
            <p className="text-destructive text-sm">{error instanceof Error ? error.message : "Could not load"}</p>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Nothing is waiting to be scheduled.</p>
          ) : (
            shown.map((line) => {
              const key = lineKey(line)
              const p = picked[key]
              return (
                <div key={key} className="rounded-md border p-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={Boolean(p)}
                      onCheckedChange={(v) => toggle(line, v === true)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{line.account_name}</span>
                        <span className="font-mono text-xs">
                          {line.amount != null ? formatNaira(line.amount) : "Amount to enter"}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {line.bank_name} · {line.account_number} · {line.requisition_number} · {line.department}
                        {line.requester_name ? ` · ${line.requester_name}` : ""}
                      </p>
                      {line.purpose ? <p className="text-muted-foreground truncate text-xs">{line.purpose}</p> : null}
                      {line.unpaid_before ? (
                        <p className="text-danger mt-1 flex items-center gap-1 text-xs">
                          <CircleAlert className="h-3 w-3" /> Came back unpaid before
                        </p>
                      ) : null}
                    </div>
                  </label>
                  {p ? (
                    <div className="mt-3 grid gap-2 pl-7 sm:grid-cols-2">
                      <div className="space-y-1">
                        <span className="text-muted-foreground text-xs">
                          Amount (₦) · up to {formatNaira(line.outstanding)}
                        </span>
                        <Input
                          inputMode="decimal"
                          value={p.amount}
                          onChange={(e) => update(line, { amount: e.target.value })}
                          aria-label={`Amount for ${line.account_name}`}
                        />
                      </div>
                      {line.bank_code ? null : (
                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xs">
                            Bank (&ldquo;{line.bank_name}&rdquo; was typed by hand)
                          </span>
                          <SearchableSelect
                            value={p.bank_code}
                            onValueChange={(v) => update(line, { bank_code: v })}
                            options={BANK_OPTIONS}
                            placeholder="Pick the bank"
                            searchPlaceholder="Search banks"
                          />
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-muted-foreground text-sm">
            {chosen.length} selected · {formatNaira(total)}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy || chosen.length === 0}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add {chosen.length || ""} to schedule
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
