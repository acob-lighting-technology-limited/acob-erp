"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { logger } from "@/lib/logger"

const log = logger("dev-login-logs-dev-login-logs-content")


type DevLoginLogRow = {
  id: string
  email: string
  full_name: string | null
  role: string
  ip_address: string | null
  user_agent: string | null
  auth_method: string | null
  login_at: string
}

function toCsv(rows: DevLoginLogRow[]) {
  const headers = ["time", "email", "name", "role", "ip", "auth_method", "user_agent"]
  const body = rows.map((r) => [
    r.login_at,
    r.email,
    r.full_name || "",
    r.role,
    r.ip_address || "",
    r.auth_method || "",
    r.user_agent || "",
  ])
  const escaped = [headers, ...body].map((line) =>
    line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  )
  return escaped.join("\n")
}

export function DevLoginLogsContent() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DevLoginLogRow[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [emailFilter, setEmailFilter] = useState("")
  const [ipFilter, setIpFilter] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const load = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const response = await fetch("/api/admin/dev/login-logs", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || `Failed to load logs (${response.status})`)
      }

      setRows((payload?.data || []) as DevLoginLogRow[])
    } catch (error: any) {
      log.error(error)
      toast.error("Failed to load developer login logs")
      setErrorMessage(error?.message || "Unknown error while loading dev login logs.")
      setRows([])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const start = startDate ? new Date(startDate).getTime() : null
    const end = endDate ? new Date(`${endDate}T23:59:59.999Z`).getTime() : null

    return rows.filter((r) => {
      const time = new Date(r.login_at).getTime()
      if (start !== null && time < start) return false
      if (end !== null && time > end) return false
      if (emailFilter && !r.email.toLowerCase().includes(emailFilter.toLowerCase())) return false
      if (ipFilter && !(r.ip_address || "").toLowerCase().includes(ipFilter.toLowerCase())) return false
      if (roleFilter !== "all" && r.role !== roleFilter) return false
      if (methodFilter !== "all" && (r.auth_method || "unknown") !== methodFilter) return false
      return true
    })
  }, [rows, emailFilter, ipFilter, roleFilter, methodFilter, startDate, endDate])

  const exportCsv = () => {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `dev-login-logs-${new Date().toISOString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const roleOptions = Array.from(new Set(rows.map((r) => r.role))).sort()

  return (
    <Card>
      <CardHeader className="gap-4">
        <CardTitle>Sign-in Events ({filtered.length})</CardTitle>
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Input value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} placeholder="Filter email" />
          <Input value={ipFilter} onChange={(e) => setIpFilter(e.target.value)} placeholder="Filter IP" />
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roleOptions.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Auth method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="password">Password</SelectItem>
              <SelectItem value="otp">OTP</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Method</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>Loading...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>No login logs found yet.</TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.login_at).toLocaleString()}</TableCell>
                  <TableCell>{row.full_name || "Unknown"}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.role}</Badge>
                  </TableCell>
                  <TableCell>{row.ip_address || "-"}</TableCell>
                  <TableCell>{row.auth_method || "unknown"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
