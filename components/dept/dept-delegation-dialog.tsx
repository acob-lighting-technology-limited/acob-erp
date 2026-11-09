"use client"

import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
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
import { useAdminScopeOptional } from "@/components/admin-scope-context"
import { apiFetch } from "@/lib/api-client"
import { ADMIN_ONLY_PAGES, DEPT_DELEGABLE_PAGES } from "@/lib/dept/delegated-pages"
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
  is_admin: boolean
}

interface AdminPage {
  key: string
  label: string
  group: string
}

interface DelegationData {
  delegations: DelegationRow[]
  candidates: Candidate[]
  /** Admin-side pages this lead is able to hand over. */
  adminPages: AdminPage[]
  /** The /admin edit routes this lead can pass on, including those behind console pages. */
  adminRoutes: string[]
}

interface PageOption {
  key: string
  label: string
  /** Also hands over the matching page on the admin side. */
  alsoAdmin: boolean
}

const PAGE_LABEL = new Map<string, string>([
  ...DEPT_DELEGABLE_PAGES.map((page) => [page.key, page.label] as const),
  ...ADMIN_ONLY_PAGES.map((page) => [page.key, page.label] as const),
])

/** End of the chosen day in West Africa Time, as an ISO string with offset. */
function endOfDayWat(date: string) {
  return `${date}T23:59:59+01:00`
}

async function readError(res: Response, fallback: string) {
  const json = await res.json().catch(() => null)
  return new Error(json?.error || fallback)
}

/**
 * "Delegate access" on a department page: the one place a lead hands work to someone else. The lead
 * picks who, which pages, and until when. Console pages open that department for the delegate;
 * pages that also exist on the admin side hand over edit there too, and admin-only pages (Lunch
 * Register and the like) are listed for leads who own them. Also lists what is handed out, with a
 * way to take it back.
 */
export function DeptDelegationButton({ deptId }: { deptId: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [personId, setPersonId] = useState("")
  const [pages, setPages] = useState<string[]>([])
  const [until, setUntil] = useState("")

  const queryKey = QUERY_KEYS.deptDelegations(deptId)
  const { data, isError } = useQuery({
    queryKey,
    queryFn: async (): Promise<DelegationData> => {
      const res = await apiFetch(`/api/dept/${deptId}/delegations`, { cache: "no-store" })
      if (!res.ok) throw await readError(res, "Could not load delegations")
      return ((await res.json()) as { data: DelegationData }).data
    },
    enabled: open,
  })

  const groups = useMemo(() => {
    const adminRoutes = data?.adminRoutes ?? []
    const map = new Map<string, PageOption[]>()
    const add = (group: string, option: PageOption) => map.set(group, [...(map.get(group) ?? []), option])
    for (const page of DEPT_DELEGABLE_PAGES) {
      add(page.group, {
        key: page.key,
        label: page.label,
        alsoAdmin: (page.adminRoutes ?? []).some((route) => adminRoutes.includes(route)),
      })
    }
    for (const page of data?.adminPages ?? []) add(page.group, { key: page.key, label: page.label, alsoAdmin: false })
    return Array.from(map.entries())
  }, [data])

  const person = data?.candidates.find((candidate) => candidate.id === personId)
  const needsAdminRole = useMemo(() => {
    const onAdminSide = new Set<string>([...(data?.adminPages ?? []).map((page) => page.key)])
    for (const page of DEPT_DELEGABLE_PAGES) {
      if ((page.adminRoutes ?? []).some((route) => data?.adminRoutes.includes(route))) onAdminSide.add(page.key)
    }
    return pages.some((key) => onAdminSide.has(key))
  }, [data, pages])

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/dept/${deptId}/delegations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delegateId: personId, pages, validUntil: endOfDayWat(until) }),
      })
      if (!res.ok) throw await readError(res, "Could not save")
      return (await res.json()) as { skipped?: Array<{ label: string; reason: string }> }
    },
    onSuccess: (result) => {
      toast.success("Access delegated")
      for (const item of result.skipped ?? []) toast.warning(`${item.label} not included: ${item.reason}`)
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

  const canSubmit = !isError && Boolean(personId) && pages.length > 0 && Boolean(until)

  function toggleGroup(options: PageOption[], on: boolean) {
    const keys = options.map((option) => option.key)
    setPages((prev) => (on ? Array.from(new Set([...prev, ...keys])) : prev.filter((key) => !keys.includes(key))))
  }

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
              Let someone do part of your work for you. Tick what they may use, and the date it ends. You can take it
              back any time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {isError && (
              <p className="text-destructive rounded-lg border p-3 text-sm">
                Could not load the people and pages you can delegate. Nothing has been saved. Try again shortly.
              </p>
            )}
            <section className="space-y-2">
              <Label>1. Who will act for you?</Label>
              <SearchableSelect
                value={personId}
                onValueChange={setPersonId}
                placeholder="Choose a person"
                searchPlaceholder="Search people..."
                options={(data?.candidates ?? []).map((candidate) => ({
                  value: candidate.id,
                  label: candidate.department ? `${candidate.name} (${candidate.department})` : candidate.name,
                }))}
              />
              {person && !person.is_admin && needsAdminRole && (
                <p className="text-warning text-xs">
                  {person.name} is not an admin, so pages marked &quot;admin side&quot; will not be included. They get
                  the department pages only.
                </p>
              )}
            </section>

            <section className="space-y-3">
              <Label>2. What can they use?</Label>
              {groups.map(([group, options]) => {
                const allOn = options.every((option) => pages.includes(option.key))
                return (
                  <div key={group} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{group}</p>
                      <button
                        type="button"
                        className="text-primary text-xs hover:underline"
                        onClick={() => toggleGroup(options, !allOn)}
                      >
                        {allOn ? "Clear" : "Select all"}
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {options.map((option) => (
                        <label key={option.key} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={pages.includes(option.key)}
                            onCheckedChange={(checked) =>
                              setPages((prev) =>
                                checked ? [...prev, option.key] : prev.filter((key) => key !== option.key)
                              )
                            }
                          />
                          <span>
                            {option.label}
                            {option.alsoAdmin && (
                              <span className="text-muted-foreground block text-xs">Also on the admin side</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
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

/**
 * The header version: finds the department from the URL and shows only to the department's lead
 * (nothing on /admin, and nothing for a delegate, who cannot delegate onward).
 */
export function DeptDelegationAction() {
  const pathname = usePathname()
  const scope = useAdminScopeOptional()
  const deptId = pathname?.split("/")[1] === "dept" ? pathname.split("/")[2] : undefined
  if (!deptId || scope?.delegated) return null
  return <DeptDelegationButton deptId={deptId} />
}
