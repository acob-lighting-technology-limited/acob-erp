"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UserCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
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
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { apiFetch } from "@/lib/api-client"
import { DEPT_DELEGABLE_PAGES } from "@/lib/dept/delegated-pages"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatWATDate } from "@/lib/utils/date"

interface DelegationRow {
  id: string
  delegate_id: string
  delegate_name: string
  pages: string[]
  valid_until: string
}

interface Candidate {
  id: string
  name: string
  department: string | null
}

interface DelegationData {
  delegations: DelegationRow[]
  candidates: Candidate[]
}

const PAGE_LABEL = new Map(DEPT_DELEGABLE_PAGES.map((page) => [page.key, page.label]))

/** End of the chosen day in West Africa Time, as an ISO string with offset. */
function endOfDayWat(date: string) {
  return `${date}T23:59:59+01:00`
}

async function readError(res: Response, fallback: string) {
  const json = await res.json().catch(() => null)
  return new Error(json?.error || fallback)
}

/**
 * "Delegate access" on a department page. The lead picks who, which of their department's pages,
 * and until when; that person then sees this department with only those pages. Also lists what
 * is currently handed out, with a way to take it back.
 */
export function DeptDelegationButton({ deptId }: { deptId: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [personId, setPersonId] = useState("")
  const [pages, setPages] = useState<string[]>([])
  const [until, setUntil] = useState("")

  const queryKey = QUERY_KEYS.deptDelegations(deptId)
  const { data } = useQuery({
    queryKey,
    queryFn: async (): Promise<DelegationData> => {
      const res = await apiFetch(`/api/dept/${deptId}/delegations`, { cache: "no-store" })
      if (!res.ok) throw await readError(res, "Could not load delegations")
      return ((await res.json()) as { data: DelegationData }).data
    },
    enabled: open,
  })

  const groups = useMemo(() => {
    const map = new Map<string, typeof DEPT_DELEGABLE_PAGES>()
    for (const page of DEPT_DELEGABLE_PAGES) map.set(page.group, [...(map.get(page.group) ?? []), page])
    return Array.from(map.entries())
  }, [])

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/dept/${deptId}/delegations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delegateId: personId, pages, validUntil: endOfDayWat(until) }),
      })
      if (!res.ok) throw await readError(res, "Could not save")
    },
    onSuccess: () => {
      toast.success("Access delegated")
      setPersonId("")
      setPages([])
      setUntil("")
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const withdraw = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/dept/${deptId}/delegations?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!res.ok) throw await readError(res, "Could not withdraw")
    },
    onSuccess: () => {
      toast.success("Access withdrawn")
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const canSubmit = Boolean(personId) && pages.length > 0 && Boolean(until)

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setOpen(true)}>
        <UserCheck className="h-4 w-4" />
        Delegate access
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Delegate access</DialogTitle>
            <DialogDescription>
              Let someone work in this department for you. They see only the pages you tick, until the date you choose.
              You can take it back any time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <section className="space-y-2">
              <Label>1. Who will act for you?</Label>
              <SearchableSelect
                value={personId}
                onValueChange={setPersonId}
                placeholder="Choose a person"
                searchPlaceholder="Search people..."
                options={(data?.candidates ?? []).map((person) => ({
                  value: person.id,
                  label: person.department ? `${person.name} (${person.department})` : person.name,
                }))}
              />
            </section>

            <section className="space-y-3">
              <Label>2. Which pages?</Label>
              {groups.map(([group, groupPages]) => (
                <div key={group} className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-semibold">{group}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {groupPages.map((page) => (
                      <label key={page.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={pages.includes(page.key)}
                          onCheckedChange={(checked) =>
                            setPages((prev) => (checked ? [...prev, page.key] : prev.filter((key) => key !== page.key)))
                          }
                        />
                        {page.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <Label htmlFor="dept-delegation-until">3. Until when?</Label>
              <Input id="dept-delegation-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              <p className="text-muted-foreground text-xs">It ends on its own on this day.</p>
            </section>

            {(data?.delegations.length ?? 0) > 0 && (
              <section className="space-y-2">
                <Label>Handed out now</Label>
                <ul className="space-y-2">
                  {data!.delegations.map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                      <div className="space-y-1">
                        <p className="font-medium">{row.delegate_name}</p>
                        <div className="flex flex-wrap gap-1">
                          {row.pages.map((key) => (
                            <Badge key={key} variant="outline">
                              {PAGE_LABEL.get(key) ?? key}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-muted-foreground text-xs">Until {formatWATDate(row.valid_until)}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => withdraw.mutate(row.id)}
                        disabled={withdraw.isPending}
                      >
                        Withdraw
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={() => save.mutate()} disabled={!canSubmit || save.isPending}>
              {save.isPending ? "Saving..." : "Delegate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
