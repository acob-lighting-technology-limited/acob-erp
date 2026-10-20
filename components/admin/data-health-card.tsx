"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Building2, CheckCircle2, ChevronRight, UserX, Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { QueryError } from "@/components/ui/query-states"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

type Person = { id: string; name: string; department: string | null }

interface DataHealth {
  activeStaff: number
  missingDepartment: Person[]
  departmentsWithoutLead: Array<{ id: string; name: string }>
  /** null when the auth user list could not be read. */
  inactive: Array<Person & { lastSignInAt: string | null }> | null
  inactiveDays: number
}

type TabKey = "department" | "lead" | "inactive"

/** One row of the check: primary text, secondary column, trailing detail, link. */
type Row = { id: string; primary: string; secondary: string; detail?: string; href: string }

const PREVIEW = 8

function buildTabs(data: DataHealth) {
  return [
    {
      key: "department" as const,
      label: "No department",
      icon: Building2,
      hint: "Leave, tasks and reports for these people have no manager to go to.",
      columns: ["Employee", "Department text"],
      count: data.missingDepartment.length,
      rows: data.missingDepartment.map<Row>((p) => ({
        id: p.id,
        primary: p.name,
        secondary: p.department || "—",
        href: `/admin/hr/employees/${p.id}`,
      })),
    },
    {
      key: "lead" as const,
      label: "No lead",
      icon: Users,
      hint: "Nobody receives these departments' leave and task approvals.",
      columns: ["Department", ""],
      count: data.departmentsWithoutLead.length,
      rows: data.departmentsWithoutLead.map<Row>((d) => ({
        id: d.id,
        primary: d.name,
        secondary: "",
        href: "/admin/hr/departments",
      })),
    },
    {
      key: "inactive" as const,
      label: `No sign-in (${data.inactiveDays}d)`,
      icon: UserX,
      hint:
        data.inactive === null
          ? "Sign-in dates are unavailable: some login accounts are malformed, so the user list cannot be read."
          : "Usually a missed invite, or a leaver still marked active.",
      columns: ["Employee", "Department", "Last sign-in"],
      count: data.inactive?.length ?? null,
      rows: (data.inactive ?? []).map<Row>((p) => ({
        id: p.id,
        primary: p.name,
        secondary: p.department || "—",
        detail: p.lastSignInAt ? formatDate(p.lastSignInAt) : "Never",
        href: `/admin/hr/employees/${p.id}`,
      })),
    },
  ]
}

/**
 * Admin "data health" (audit 2.4): the records that quietly break routing —
 * people with no department, departments with no lead, and accounts nobody
 * uses. One tab per check; each row links to the record to fix it.
 */
export function DataHealthCard() {
  const [tab, setTab] = useState<TabKey>("department")
  const [expanded, setExpanded] = useState(false)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEYS.adminDataHealth(),
    queryFn: () => apiJson<DataHealth>("/api/admin/hr/data-health", { cache: "no-store" }),
    staleTime: 5 * 60 * 1000,
  })

  if (isError) {
    return (
      <Card className="p-4">
        <QueryError message="Could not load the data-health check." onRetry={() => void refetch()} />
      </Card>
    )
  }

  if (isLoading || !data) {
    return (
      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex gap-2 border-b p-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-32" />
          ))}
        </div>
        <div className="divide-y">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="px-4 py-3">
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  const tabs = buildTabs(data)
  const active = tabs.find((t) => t.key === tab) ?? tabs[0]
  const visible = expanded ? active.rows : active.rows.slice(0, PREVIEW)
  const showDetail = active.columns.length > 2
  const showSecondary = active.columns[1] !== ""

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
        <div role="tablist" aria-label="Data-health checks" className="flex flex-wrap gap-1">
          {tabs.map((t) => {
            const selected = t.key === active.key
            const Icon = t.icon
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setTab(t.key)
                  setExpanded(false)
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  selected
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                    t.count === null
                      ? "bg-neutral-muted text-neutral-foreground"
                      : t.count > 0
                        ? "bg-warning-muted text-warning-foreground"
                        : "bg-success-muted text-success-foreground"
                  )}
                >
                  {t.count ?? "—"}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-muted-foreground px-1 text-xs">{data.activeStaff} active staff checked</p>
      </div>

      <p className="text-muted-foreground border-b px-4 py-2 text-xs">{active.hint}</p>

      {active.rows.length === 0 ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 px-4 py-8 text-sm">
          {active.count === null ? (
            "Nothing to show."
          ) : (
            <>
              <CheckCircle2 className="text-success-foreground h-4 w-4" aria-hidden />
              All clear.
            </>
          )}
        </div>
      ) : (
        <>
          <div
            className={cn(
              "bg-muted/50 text-muted-foreground grid gap-4 border-b px-4 py-2 text-xs font-medium tracking-wide uppercase",
              showDetail
                ? "grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_1rem]"
                : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1rem]"
            )}
          >
            <span>{active.columns[0]}</span>
            <span className={cn(!showDetail && "hidden sm:block")}>{active.columns[1]}</span>
            {showDetail ? <span className="text-right">{active.columns[2]}</span> : null}
            <span />
          </div>
          <ul className="divide-y">
            {visible.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className={cn(
                    "hover:bg-muted/50 grid items-center gap-4 px-4 py-2.5 text-sm transition-colors",
                    showDetail
                      ? "grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_1rem]"
                      : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1rem]"
                  )}
                >
                  <span className="truncate font-medium">{row.primary}</span>
                  <span className={cn("text-muted-foreground truncate", !showDetail && "hidden sm:block")}>
                    {showSecondary ? row.secondary : ""}
                  </span>
                  {showDetail ? (
                    <span className="text-muted-foreground text-right text-xs tabular-nums">{row.detail}</span>
                  ) : null}
                  <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {active.rows.length > PREVIEW ? (
            <div className="border-t px-4 py-2">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Show less" : `Show all ${active.rows.length}`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  )
}
