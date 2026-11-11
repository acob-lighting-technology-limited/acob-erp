"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronDown, ChevronRight, CircleAlert, Loader2 } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { formatWATDateTime } from "@/lib/utils/date"

const BANK_OPTIONS = NIGERIAN_BANKS.map((b) => ({ value: b.code, label: b.name }))

const lineKey = (l: Pick<SchedulableLine, "requisition_id" | "beneficiary_index">) =>
  `${l.requisition_id}:${l.beneficiary_index}`

interface Group {
  requisitionId: string
  number: string
  requester: string | null
  department: string
  purpose: string | null
  requestedAt: string
  total: number
  lines: SchedulableLine[]
}

/**
 * Pick verified Payment Requests for a draft schedule. They are grouped by
 * requisition: the first-level tick takes the whole request, and its lines can
 * be opened to tick or untick one beneficiary. Amounts are fixed by the
 * requisition and cannot be changed here. The period filter works on when each
 * request was raised.
 */
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
  // Selected line key -> the bank, only needed when the requisition's bank could not be worked out.
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setPicked({})
      setExpanded(new Set())
      setQuery("")
      void refetch()
    }
  }, [open, refetch])

  const groups: Group[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byReq = new Map<string, Group>()
    for (const line of lines) {
      if (
        q &&
        ![line.requisition_number, line.account_name, line.requester_name, line.department, line.purpose]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      ) {
        continue
      }
      const existing = byReq.get(line.requisition_id)
      if (existing) {
        existing.lines.push(line)
        existing.total += Number(line.amount) || 0
      } else {
        byReq.set(line.requisition_id, {
          requisitionId: line.requisition_id,
          number: line.requisition_number,
          requester: line.requester_name,
          department: line.department,
          purpose: line.purpose,
          requestedAt: line.requested_at,
          total: Number(line.amount) || 0,
          lines: [line],
        })
      }
    }
    return Array.from(byReq.values()).sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
  }, [lines, query])

  const selectableLines = groups.flatMap((g) => g.lines.filter((l) => l.amount != null))
  const chosen = lines.filter((l) => picked[lineKey(l)] !== undefined)
  const total = chosen.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
  const allShownTicked = selectableLines.length > 0 && selectableLines.every((l) => picked[lineKey(l)] !== undefined)

  const setLines = (target: SchedulableLine[], on: boolean) =>
    setPicked((prev) => {
      const next = { ...prev }
      for (const l of target) {
        if (l.amount == null) continue
        if (on) next[lineKey(l)] = next[lineKey(l)] ?? l.bank_code ?? ""
        else delete next[lineKey(l)]
      }
      return next
    })

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async () => {
    for (const l of chosen) {
      if (!picked[lineKey(l)]) return toast.error(`Pick the bank for ${l.account_name} (${l.requisition_number})`)
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
            ...(l.bank_code ? {} : { bank_code: picked[lineKey(l)] }),
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
      void refetch()
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
            Verified Payment Requests not yet paid, oldest first. Tick a request to take all its payments, or open it to
            pick one. Amounts are fixed by the request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            placeholder="Search reference, name, department…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {selectableLines.length ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <Checkbox checked={allShownTicked} onCheckedChange={(v) => setLines(selectableLines, v === true)} />
              Select everything shown ({selectableLines.length} payment{selectableLines.length === 1 ? "" : "s"})
            </label>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {isLoading ? (
            <RowsSkeleton rows={4} />
          ) : error ? (
            <p className="text-destructive text-sm">{error instanceof Error ? error.message : "Could not load"}</p>
          ) : groups.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {lines.length ? "Nothing matches your search." : "Nothing is waiting to be scheduled."}
            </p>
          ) : (
            groups.map((group) => {
              const isOpen = expanded.has(group.requisitionId)
              const selectable = group.lines.filter((l) => l.amount != null)
              const ticked = selectable.filter((l) => picked[lineKey(l)] !== undefined).length
              const state: boolean | "indeterminate" =
                ticked === 0 ? false : ticked === selectable.length ? true : "indeterminate"
              return (
                <div key={group.requisitionId} className="rounded-md border">
                  <div className="flex items-start gap-3 p-3">
                    <Checkbox
                      checked={state}
                      disabled={!selectable.length}
                      onCheckedChange={(v) => setLines(selectable, v === true)}
                      className="mt-0.5"
                      aria-label={`Select all of ${group.number}`}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left text-sm"
                      onClick={() => toggleExpanded(group.requisitionId)}
                      aria-expanded={isOpen}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="text-primary font-mono text-xs font-semibold">{group.number}</span>
                          <span className="text-muted-foreground text-xs">
                            {group.lines.length} payment{group.lines.length === 1 ? "" : "s"}
                            {ticked ? ` · ${ticked} ticked` : ""}
                          </span>
                        </span>
                        <span className="font-mono text-xs">{formatNaira(group.total)}</span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Requested {formatWATDateTime(group.requestedAt)}
                        {group.requester ? ` · ${group.requester}` : ""} · {group.department}
                      </p>
                      {group.purpose ? (
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">{group.purpose}</p>
                      ) : null}
                    </button>
                  </div>

                  {isOpen ? (
                    <div className="space-y-px border-t">
                      {group.lines.map((line) => {
                        const key = lineKey(line)
                        const isPicked = picked[key] !== undefined
                        return (
                          <div key={key} className={cn("px-3 py-2 pl-10 text-sm", isPicked && "bg-muted/40")}>
                            <label className="flex cursor-pointer items-start gap-3">
                              <Checkbox
                                checked={isPicked}
                                disabled={line.amount == null}
                                onCheckedChange={(v) => setLines([line], v === true)}
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium">{line.account_name}</span>
                                  <span className="font-mono text-xs">
                                    {line.amount != null ? formatNaira(line.amount) : "Amount not recorded"}
                                  </span>
                                </div>
                                <p className="text-muted-foreground text-xs">
                                  {line.bank_name} · {line.account_number}
                                </p>
                                {line.unpaid_before ? (
                                  <p className="text-danger mt-1 flex items-center gap-1 text-xs">
                                    <CircleAlert className="h-3 w-3" /> Came back unpaid before
                                  </p>
                                ) : null}
                              </div>
                            </label>
                            {isPicked && !line.bank_code ? (
                              <div className="mt-2 space-y-1 pl-7">
                                <span className="text-muted-foreground text-xs">
                                  Bank (&ldquo;{line.bank_name}&rdquo; was typed by hand)
                                </span>
                                <SearchableSelect
                                  value={picked[key]}
                                  onValueChange={(v) => setPicked((prev) => ({ ...prev, [key]: v }))}
                                  options={BANK_OPTIONS}
                                  placeholder="Pick the bank"
                                  searchPlaceholder="Search banks"
                                />
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
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
