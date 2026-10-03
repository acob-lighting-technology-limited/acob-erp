"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Building2, CheckCircle2, UserX } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { QueryError } from "@/components/ui/query-states"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatDate } from "@/lib/format"

type Person = { id: string; name: string; department: string | null }

interface DataHealth {
  activeStaff: number
  missingDepartment: Person[]
  departmentsWithoutLead: Array<{ id: string; name: string }>
  /** null when the auth user list could not be read. */
  inactive: Array<Person & { lastSignInAt: string | null }> | null
  inactiveDays: number
}

const PREVIEW = 6

function Group({
  icon: Icon,
  title,
  hint,
  count,
  children,
}: {
  icon: React.ElementType
  title: string
  hint: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon
          className={count > 0 ? "text-warning-foreground h-4 w-4" : "text-success-foreground h-4 w-4"}
          aria-hidden
        />
        <p className="text-sm font-medium">{title}</p>
        <Badge variant={count > 0 ? "secondary" : "outline"} className="text-xs">
          {count}
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs">{hint}</p>
      {count > 0 ? <ul className="space-y-1 text-sm">{children}</ul> : null}
    </div>
  )
}

/**
 * Admin "data health" (audit 2.4): the records that quietly break routing —
 * people with no department, departments with no lead, and accounts nobody
 * uses. Each name links to the employee record to fix it.
 */
export function DataHealthCard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEYS.adminDataHealth(),
    queryFn: () => apiJson<DataHealth>("/api/admin/hr/data-health", { cache: "no-store" }),
    staleTime: 5 * 60 * 1000,
  })

  if (isError) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Data health</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryError message="Could not load the data-health check." onRetry={() => void refetch()} />
        </CardContent>
      </Card>
    )
  }

  const issues = data
    ? data.missingDepartment.length + data.departmentsWithoutLead.length + (data.inactive?.length ?? 0)
    : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {issues > 0 ? (
            <AlertTriangle className="text-warning-foreground h-4 w-4" aria-hidden />
          ) : (
            <CheckCircle2 className="text-success-foreground h-4 w-4" aria-hidden />
          )}
          Data health
        </CardTitle>
        <CardDescription>
          Records that stop leave, tasks and reports from reaching the right people
          {data ? ` · ${data.activeStaff} active staff` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <Group
              icon={Building2}
              title="No department"
              hint="Approvals and reports cannot route these people."
              count={data.missingDepartment.length}
            >
              {data.missingDepartment.slice(0, PREVIEW).map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/hr/employees/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                </li>
              ))}
              {data.missingDepartment.length > PREVIEW ? (
                <li className="text-muted-foreground text-xs">+{data.missingDepartment.length - PREVIEW} more</li>
              ) : null}
            </Group>

            <Group
              icon={Building2}
              title="Departments without a lead"
              hint="Nobody receives this department's leave and task approvals."
              count={data.departmentsWithoutLead.length}
            >
              {data.departmentsWithoutLead.slice(0, PREVIEW).map((d) => (
                <li key={d.id}>
                  <Link href="/admin/hr/departments" className="hover:underline">
                    {d.name}
                  </Link>
                </li>
              ))}
            </Group>

            {data.inactive === null ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserX className="text-muted-foreground h-4 w-4" aria-hidden />
                  <p className="text-sm font-medium">{`No sign-in for ${data.inactiveDays} days`}</p>
                </div>
                <p className="text-muted-foreground text-xs">
                  Sign-in dates are unavailable: some login accounts are malformed, so the user list cannot be read.
                </p>
              </div>
            ) : (
              <Group
                icon={UserX}
                title={`No sign-in for ${data.inactiveDays} days`}
                hint="Usually a missed invite or a leaver still marked active."
                count={data.inactive.length}
              >
                {data.inactive.slice(0, PREVIEW).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/hr/employees/${p.id}`} className="truncate hover:underline">
                      {p.name}
                    </Link>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {p.lastSignInAt ? formatDate(p.lastSignInAt) : "never"}
                    </span>
                  </li>
                ))}
                {data.inactive.length > PREVIEW ? (
                  <li className="text-muted-foreground text-xs">+{data.inactive.length - PREVIEW} more</li>
                ) : null}
              </Group>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
