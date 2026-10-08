"use client"

import { toCsv } from "@/lib/export/csv"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { formatWATDate, formatWATRelative } from "@/lib/utils/date"
import { Badge } from "@/components/ui/badge"
import { QUERY_KEYS } from "@/lib/query-keys"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts"
import { apiJson } from "@/lib/api-client"

/** Login-log types, CSV builder and the per-user stats view. Split from dev-login-logs-content.tsx (audit 6.1). */
export type DevLoginLogRow = {
  id: string
  user_id: string | null
  email: string
  full_name: string | null
  role: string
  department: string | null
  ip_address: string | null
  user_agent: string | null
  auth_method: string | null
  login_at: string
}

export function buildLoginLogsCsv(rows: DevLoginLogRow[]) {
  const headers = ["time", "email", "name", "role", "department", "ip", "auth_method", "user_agent"]
  const body = rows.map((row) => [
    row.login_at,
    row.email,
    row.full_name || "",
    row.role,
    row.department || "",
    row.ip_address || "",
    row.auth_method || "",
    row.user_agent || "",
  ])
  return toCsv([headers, ...body])
}

export type DevLoginLogsMeta = {
  days: number | null
  limit: number
  truncated: boolean
}

export type DevLoginLogsPayload = {
  rows: DevLoginLogRow[]
  meta: DevLoginLogsMeta | null
}

export async function fetchDevLoginLogs(days: string): Promise<DevLoginLogsPayload> {
  const response = await fetch(`/api/admin/dev/login-logs?days=${days}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error || `Failed to load logs (${response.status})`)
  }
  return {
    rows: (payload?.data || []) as DevLoginLogRow[],
    meta: (payload?.meta as DevLoginLogsMeta | undefined) ?? null,
  }
}

export async function fetchDashboardAuditLogs(department: string, userId: string | null): Promise<any[]> {
  const url = `/api/admin/dev/login-logs?type=dashboard-audit&department=${department}&user_id=${userId || "all"}`
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error || `Failed to load dashboard audit logs (${response.status})`)
  }
  return (payload?.data || []) as any[]
}

// Theme chart tokens (globals.css), so the series follow light/dark mode.
export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

// Custom tooltips matching shadcn styling
export const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card rounded-lg border border-2 p-3 text-sm shadow-md">
        <p className="text-foreground font-semibold">{label}</p>
        {payload.map((item: any) => (
          <p key={item.name} className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color || item.fill }}
            />
            {item.name}: <span className="text-foreground font-medium">{item.value}</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

// User-specific statistics detail view inside the dialog
export function UserStatsView({
  email,
  userId,
  allLogs,
}: {
  email: string
  userId: string | null
  allLogs: DevLoginLogRow[]
}) {
  const userLogs = useMemo(() => allLogs.filter((log) => log.email === email), [email, allLogs])
  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: QUERY_KEYS.devUserAuditLogs(userId ?? ""),
    queryFn: async () =>
      (await apiJson<{ data?: any[] }>(`/api/admin/dev/login-logs?type=audit&user_id=${userId}`)).data ?? [],
    enabled: Boolean(userId),
  })

  const userStats = useMemo(() => {
    const total = userLogs.length
    const firstLogin = userLogs.length > 0 ? userLogs[userLogs.length - 1].login_at : null
    const lastLogin = userLogs.length > 0 ? userLogs[0].login_at : null
    const uniqueDays = new Set(userLogs.map((log) => log.login_at.slice(0, 10))).size

    const methodCounts = new Map<string, number>()
    const ipCounts = new Map<string, number>()
    const uaCounts = new Map<string, number>()
    const hourly = new Array(24).fill(0)

    userLogs.forEach((log) => {
      const method = log.auth_method || "unknown"
      methodCounts.set(method, (methodCounts.get(method) || 0) + 1)

      if (log.ip_address) {
        ipCounts.set(log.ip_address, (ipCounts.get(log.ip_address) || 0) + 1)
      }

      if (log.user_agent) {
        const ua = log.user_agent.toLowerCase()
        let browser = "Other"
        if (ua.includes("edg/")) browser = "Edge"
        else if (ua.includes("chrome/")) browser = "Chrome"
        else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari"
        else if (ua.includes("firefox/")) browser = "Firefox"
        uaCounts.set(browser, (uaCounts.get(browser) || 0) + 1)
      }

      try {
        const hour = new Date(log.login_at).getHours()
        if (hour >= 0 && hour < 24) {
          hourly[hour] += 1
        }
      } catch (e) {}
    })

    const preferredMethod = Array.from(methodCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown"
    const ips = Array.from(ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
    const browsers = Array.from(uaCounts.entries()).map(([browser, count]) => ({ name: browser, value: count }))
    const hourlyChartData = hourly.map((count, hour) => ({ hour: `${String(hour).padStart(2, "0")}:00`, count }))

    return { total, firstLogin, lastLogin, uniqueDays, preferredMethod, ips, browsers, hourlyChartData }
  }, [userLogs])

  return (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-muted/30 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Total Logins</p>
          <p className="mt-1 text-xl font-bold">{userStats.total}</p>
        </div>
        <div className="bg-muted/30 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Active Days</p>
          <p className="mt-1 text-xl font-bold">{userStats.uniqueDays}</p>
        </div>
        <div className="bg-muted/30 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Primary Method</p>
          <p className="mt-1 text-sm font-semibold capitalize">{userStats.preferredMethod.replace(/_/g, " ")}</p>
        </div>
        <div className="bg-muted/30 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">First Login</p>
          <p className="text-muted-foreground mt-1 truncate text-xs font-semibold">
            {userStats.firstLogin
              ? formatWATDate(userStats.firstLogin, { day: "2-digit", month: "short", year: "2-digit" })
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="bg-card rounded-xl border p-4">
          <h4 className="mb-3 text-sm font-semibold">Activity by Hour</h4>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userStats.hourlyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="hour" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.15}
                  name="Logins"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card space-y-4 rounded-xl border p-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Used IP Addresses</h4>
            <div className="scrollbar-custom max-h-20 space-y-1.5 overflow-y-auto pr-1 text-xs">
              {userStats.ips.slice(0, 3).map((item) => (
                <div key={item.ip} className="text-muted-foreground flex items-center justify-between">
                  <span className="text-foreground font-mono">{item.ip}</span>
                  <span>{item.count} logins</span>
                </div>
              ))}
              {userStats.ips.length === 0 && <p className="text-muted-foreground">No IPs logged</p>}
            </div>
          </div>
          <div className="border-t pt-3">
            <h4 className="mb-2 text-sm font-semibold">Browser Distribution</h4>
            <div className="flex flex-wrap gap-2">
              {userStats.browsers.map((item) => (
                <Badge key={item.name} variant="secondary" className="text-xs">
                  {item.name}: {item.value}
                </Badge>
              ))}
              {userStats.browsers.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
            </div>
          </div>
        </div>

        <div className="bg-card col-span-full space-y-4 rounded-xl border p-4">
          <h4 className="mb-2 text-sm font-semibold">Audit History & Visited Sections</h4>
          {loadingAudit ? (
            <div className="space-y-2 py-4">
              <div className="bg-muted h-4 w-3/4 animate-pulse rounded"></div>
              <div className="bg-muted h-4 w-1/2 animate-pulse rounded"></div>
            </div>
          ) : auditLogs.length > 0 ? (
            <div className="scrollbar-custom max-h-48 space-y-3 overflow-y-auto pr-1 text-xs">
              {auditLogs.slice(0, 8).map((log) => {
                const route =
                  (log.metadata?.path as string) || (log.metadata?.url as string) || `/${log.entity_type || ""}`
                return (
                  <div key={log.id} className="flex items-start justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="px-1.5 py-0 text-xs capitalize">
                          {log.action}
                        </Badge>
                        <span className="text-foreground font-medium capitalize">
                          {log.entity_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-muted-foreground font-mono text-xs">{route}</p>
                    </div>
                    <span className="text-muted-foreground text-xs">{formatWATRelative(log.created_at)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground py-4 text-center text-xs">No recent actions recorded in audit logs.</p>
          )}
        </div>
      </div>
    </div>
  )
}
