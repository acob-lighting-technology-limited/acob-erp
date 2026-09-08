"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatWATDateTime, formatWATRelative, toLocalISODate } from "@/lib/utils/date"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { QUERY_KEYS } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  IdCard,
  Info,
  Mail,
  RefreshCw,
  Shield,
  UserCheck,
  Users,
  UserX,
} from "lucide-react"

export interface OnboardingRow {
  id: string
  employee_number: string | null
  full_name: string
  email: string
  additional_email: string | null
  department: string | null
  designation: string | null
  role: string
  employment_status: string
  avatar_url?: string | null
  has_signed_in: boolean
  last_sign_in_at: string | null
  first_sign_in_at: string | null
  sign_in_count: number
  last_auth_method: string | null
  email_confirmed: boolean
  account_created_at: string | null
  profile_created_at: string
}

const AVATAR_SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
} as const

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name.slice(0, 2) || "AC").toUpperCase()
}

function OnboardingAvatar({ row, size = "md" }: { row: OnboardingRow; size?: keyof typeof AVATAR_SIZES }) {
  const name = row.full_name || row.email || "User"
  return (
    <span
      className={cn(
        "bg-primary/10 text-primary flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        AVATAR_SIZES[size]
      )}
    >
      {row.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.avatar_url} alt={name} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  )
}

interface OnboardingMeta {
  authSourceAvailable: boolean
  loginLogsAvailable: boolean
  total: number
}

interface OnboardingPayload {
  rows: OnboardingRow[]
  meta: OnboardingMeta | null
}

async function fetchOnboarding(): Promise<OnboardingPayload> {
  const response = await fetch("/api/admin/onboarding", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error || `Failed to load onboarding status (${response.status})`)
  }
  return {
    rows: (payload?.data || []) as OnboardingRow[],
    meta: (payload?.meta as OnboardingMeta | undefined) ?? null,
  }
}

function toCsv(rows: OnboardingRow[]) {
  const headers = [
    "employee_number",
    "name",
    "email",
    "department",
    "designation",
    "role",
    "employment_status",
    "signed_in",
    "first_sign_in",
    "last_sign_in",
    "sign_ins_recorded",
    "last_method",
    "email_confirmed",
    "account_created",
  ]
  const body = rows.map((row) => [
    row.employee_number || "",
    row.full_name,
    row.email,
    row.department || "",
    row.designation || "",
    row.role,
    row.employment_status,
    row.has_signed_in ? "yes" : "no",
    row.first_sign_in_at || "",
    row.last_sign_in_at || "",
    row.sign_in_count,
    row.last_auth_method || "",
    row.email_confirmed ? "yes" : "no",
    row.account_created_at || row.profile_created_at,
  ])
  return [headers, ...body]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")
}

export function OnboardingContent() {
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.adminOnboarding(),
    queryFn: fetchOnboarding,
  })

  const rows = useMemo(() => data?.rows ?? [], [data])
  const meta = data?.meta ?? null

  type OnboardingTab = "onboardable" | "signed_in" | "never" | "all"
  const [activeTab, setActiveTab] = useState<OnboardingTab>("onboardable")

  const stats = useMemo(() => {
    // Exited staff are gone, not "not yet onboarded" — excluded so they don't
    // inflate "Never Signed In" with people who will never sign in again.
    const current = rows.filter((row) => row.employment_status !== "exited")
    const total = current.length
    const onboardable = current.filter((row) => row.email && row.email.trim() !== "").length
    const signedIn = current.filter((row) => row.has_signed_in).length
    const neverSignedIn = onboardable - signedIn
    const rate = onboardable > 0 ? Math.round((signedIn / onboardable) * 100) : 0
    return { total, onboardable, signedIn, neverSignedIn, rate }
  }, [rows])

  const tabs: DataTableTab[] = useMemo(
    () => [
      { key: "onboardable", label: `Onboardable (${stats.onboardable})`, icon: UserCheck },
      { key: "signed_in", label: `Signed In (${stats.signedIn})`, icon: CheckCircle2 },
      { key: "never", label: `Never (${stats.neverSignedIn})`, icon: UserX },
      { key: "all", label: `All (${rows.length})`, icon: Users },
    ],
    [stats, rows.length]
  )

  const scopedRows = useMemo(() => {
    if (activeTab === "onboardable") {
      return rows.filter((r) => r.employment_status !== "exited" && r.email && r.email.trim() !== "")
    }
    if (activeTab === "signed_in") {
      return rows.filter((r) => r.employment_status !== "exited" && r.has_signed_in)
    }
    if (activeTab === "never") {
      return rows.filter(
        (r) => r.employment_status !== "exited" && !r.has_signed_in && r.email && r.email.trim() !== ""
      )
    }
    return rows
  }, [rows, activeTab])

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.department).filter((dept): dept is string => Boolean(dept))))
        .sort()
        .map((dept) => ({ value: dept, label: dept })),
    [rows]
  )

  const roleOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.role).filter(Boolean)))
        .sort()
        .map((role) => ({ value: role, label: role.replace(/_/g, " ") })),
    [rows]
  )

  const employmentStatusOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.employment_status).filter(Boolean)))
        .sort()
        .map((status) => ({ value: status, label: status.replace(/_/g, " ") })),
    [rows]
  )

  const columns = useMemo<DataTableColumn<OnboardingRow>[]>(
    () => [
      {
        key: "full_name",
        label: "Person",
        sortable: true,
        accessor: (row) => row.full_name,
        resizable: true,
        initialWidth: 240,
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <OnboardingAvatar row={row} size="sm" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.full_name}</span>
              <span className="text-muted-foreground font-mono text-xs">{row.employee_number || "—"}</span>
            </div>
          </div>
        ),
      },
      {
        key: "email",
        label: "Email",
        sortable: true,
        accessor: (row) => row.email,
        resizable: true,
        initialWidth: 240,
        render: (row) => <span className="text-muted-foreground text-sm break-all">{row.email || "—"}</span>,
      },
      {
        key: "signed_in",
        label: "Sign-in Status",
        sortable: true,
        accessor: (row) => (row.has_signed_in ? "Signed in" : "Never signed in"),
        render: (row) =>
          row.has_signed_in ? (
            <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">Signed in</Badge>
          ) : (
            <Badge className="border-red-500/20 bg-red-500/10 text-red-600">Never signed in</Badge>
          ),
      },
      {
        key: "last_sign_in_at",
        label: "Last Sign-in",
        sortable: true,
        accessor: (row) => row.last_sign_in_at || "",
        hideOnMobile: true,
        render: (row) =>
          row.last_sign_in_at ? (
            <span className="text-sm">{formatWATDateTime(row.last_sign_in_at)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "first_sign_in_at",
        label: "First Sign-in",
        sortable: true,
        accessor: (row) => row.first_sign_in_at || "",
        hideOnMobile: true,
        defaultVisible: false,
        render: (row) =>
          row.first_sign_in_at ? (
            <span className="text-sm">{formatWATDateTime(row.first_sign_in_at)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "department",
        label: "Department",
        sortable: true,
        accessor: (row) => row.department || "",
        hideOnMobile: true,
        render: (row) => row.department || "—",
      },
      {
        key: "employment_status",
        label: "Employment",
        sortable: true,
        accessor: (row) => row.employment_status,
        hideOnMobile: true,
        defaultVisible: false,
        render: (row) => <span className="capitalize">{row.employment_status.replace(/_/g, " ")}</span>,
      },
      {
        key: "role",
        label: "Role",
        sortable: true,
        accessor: (row) => row.role,
        hideOnMobile: true,
        defaultVisible: false,
        render: (row) => <span className="capitalize">{row.role.replace(/_/g, " ")}</span>,
      },
    ],
    []
  )

  const filters = useMemo<DataTableFilter<OnboardingRow>[]>(
    () => [
      {
        key: "department",
        label: "Department",
        options: departmentOptions,
      },
      {
        key: "role",
        label: "Role",
        options: roleOptions,
      },
      {
        key: "employment_status",
        label: "Employment Status",
        options: employmentStatusOptions,
      },
    ],
    [departmentOptions, employmentStatusOptions, roleOptions]
  )

  const exportCsv = () => {
    const csv = toCsv(scopedRows)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `onboarding-status-${toLocalISODate(new Date())}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DataTablePage
      title="Onboarding"
      description="Every staff profile, including not-yet-onboarded placeholders, and whether the person has ever signed in."
      icon={UserCheck}
      backLink={{ href: "/admin", label: "Back to Admin" }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab as OnboardingTab)}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOnboarding() })}
            disabled={isLoading}
            className="h-8 gap-1.5 sm:gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" onClick={exportCsv} disabled={scopedRows.length === 0} className="h-8 gap-1.5 sm:gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      }
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <StatCard
            variant="compact"
            title="Profiles"
            value={stats.total}
            icon={Users}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Onboardable"
            value={stats.onboardable}
            icon={UserCheck}
            iconBgColor="bg-indigo-500/10"
            iconColor="text-indigo-500"
          />
          <StatCard
            variant="compact"
            title="Signed In"
            value={stats.signedIn}
            icon={CheckCircle2}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            variant="compact"
            title="Never Signed In"
            value={stats.neverSignedIn}
            icon={UserX}
            iconBgColor="bg-red-500/10"
            iconColor="text-red-500"
          />
        </div>
      }
    >
      <div className="space-y-4">
        {meta && !meta.authSourceAvailable ? (
          <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200">
            <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs">
              The auth service could not be read, so sign-in status falls back to in-app login logs only. Anyone whose
              last sign-in predates login logging will be shown as never signed in.
            </AlertDescription>
          </Alert>
        ) : null}

        <DataTable<OnboardingRow>
          data={scopedRows}
          columns={columns}
          filters={filters}
          getRowId={(row) => row.id}
          pagination={{ pageSize: 50 }}
          searchPlaceholder="Search name, email, employee number, or department..."
          searchFn={(row, query) => {
            const q = query.toLowerCase()
            return (
              row.full_name.toLowerCase().includes(q) ||
              row.email.toLowerCase().includes(q) ||
              (row.additional_email || "").toLowerCase().includes(q) ||
              (row.employee_number || "").toLowerCase().includes(q) ||
              (row.department || "").toLowerCase().includes(q) ||
              (row.designation || "").toLowerCase().includes(q)
            )
          }}
          isLoading={isLoading}
          error={error instanceof Error ? error.message : null}
          onRetry={() => {
            void refetch()
          }}
          expandable={{
            render: (row) => (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">First Recorded Sign-in</p>
                  <p className="mt-2 text-sm">
                    {row.first_sign_in_at ? formatWATDateTime(row.first_sign_in_at) : "Not recorded"}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">Recorded Sign-ins</p>
                  <p className="mt-2 text-sm">
                    {row.sign_in_count}
                    {row.last_auth_method ? ` · last via ${row.last_auth_method}` : ""}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">Account Created</p>
                  <p className="mt-2 text-sm">{formatWATDateTime(row.account_created_at || row.profile_created_at)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">Role</p>
                  <p className="mt-2 text-sm">
                    <Badge variant="outline">{row.role.replace(/_/g, " ")}</Badge>
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">Designation</p>
                  <p className="mt-2 text-sm">{row.designation || "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">Additional Email</p>
                  <p className="mt-2 text-sm break-all">{row.additional_email || "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">Email Confirmed</p>
                  <p className="mt-2 text-sm">{row.email_confirmed ? "Yes" : "No"}</p>
                </div>
              </div>
            ),
          }}
          viewToggle
          contactsView
          stickyToolbar
          defaultViewMode={{ mobile: "contacts", desktop: "list" }}
          mobileRow={{
            leading: (row) => <OnboardingAvatar row={row} size="sm" />,
            title: (row) => row.full_name,
            subtitle: (row) => [row.department, row.employee_number || row.email].filter(Boolean).join(" · ") || "—",
            trailing: (row) =>
              row.has_signed_in ? (
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600">
                  Signed in
                </Badge>
              ) : (
                <Badge className="border-red-500/20 bg-red-500/10 text-[10px] text-red-600">Never</Badge>
              ),
            detail: {
              title: (row) => row.full_name,
              subtitle: (row) => [row.designation, row.department].filter(Boolean).join(" · ") || "Staff Profile",
              avatar: (row) => <OnboardingAvatar row={row} size="xl" />,
              badges: (row) =>
                row.has_signed_in ? (
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">Signed in</Badge>
                ) : (
                  <Badge className="border-red-500/20 bg-red-500/10 text-red-600">Never signed in</Badge>
                ),
              fields: (row) => [
                { icon: Mail, label: "Email", value: row.email || "—", fullWidth: true, copyable: Boolean(row.email) },
                {
                  icon: Mail,
                  label: "Alt. Email",
                  value: row.additional_email || "—",
                  muted: !row.additional_email,
                  fullWidth: true,
                  copyable: Boolean(row.additional_email),
                },
                { icon: Building2, label: "Department", value: row.department || "—" },
                {
                  icon: IdCard,
                  label: "Staff ID",
                  value: row.employee_number || "—",
                  copyable: Boolean(row.employee_number),
                },
                { icon: Shield, label: "Role", value: row.role.replace(/_/g, " ") },
                { icon: UserCheck, label: "Employment", value: row.employment_status.replace(/_/g, " ") },
                {
                  icon: Calendar,
                  label: "First Sign-in",
                  value: row.first_sign_in_at ? formatWATDateTime(row.first_sign_in_at) : "Not recorded",
                },
                {
                  icon: Calendar,
                  label: "Last Sign-in",
                  value: row.last_sign_in_at ? formatWATDateTime(row.last_sign_in_at) : "Not recorded",
                },
                {
                  icon: Clock,
                  label: "Recorded Sign-ins",
                  value:
                    row.sign_in_count > 0
                      ? `${row.sign_in_count}${row.last_auth_method ? ` via ${row.last_auth_method}` : ""}`
                      : "0",
                },
                {
                  icon: Calendar,
                  label: "Account Created",
                  value: formatWATDateTime(row.account_created_at || row.profile_created_at),
                },
              ],
            },
          }}
          cardRenderer={(row) => (
            <div className="bg-card space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <OnboardingAvatar row={row} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{row.full_name}</p>
                    <p className="text-muted-foreground truncate text-xs">{row.email || "No email"}</p>
                  </div>
                </div>
                {row.has_signed_in ? (
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">Signed in</Badge>
                ) : (
                  <Badge className="border-red-500/20 bg-red-500/10 text-red-600">Never</Badge>
                )}
              </div>
              <div className="grid gap-1 border-t pt-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Department</span>
                  <span>{row.department || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Staff ID</span>
                  <span className="font-mono">{row.employee_number || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last sign-in</span>
                  <span>{row.last_sign_in_at ? formatWATRelative(row.last_sign_in_at) : "—"}</span>
                </div>
              </div>
            </div>
          )}
          emptyTitle="No accounts found"
          emptyDescription="Staff accounts will appear here once profiles exist."
          emptyIcon={Users}
          skeletonRows={8}
          urlSync
        />
      </div>
    </DataTablePage>
  )
}
