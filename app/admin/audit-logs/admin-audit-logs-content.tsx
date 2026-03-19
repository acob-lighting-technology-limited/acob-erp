"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, LayoutGrid, List, ScrollText, Download } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { normalizeAuditAction } from "@/lib/audit/core"
import { AuditLogFilters } from "@/components/audit/AuditLogFilters"
import { AuditLogTable } from "@/components/audit/AuditLogTable"
import { AuditLogCard } from "@/components/audit/AuditLogCard"
import { AuditLogDetailPanel } from "@/components/audit/AuditLogDetailPanel"
import { exportAuditLogsToExcel, exportAuditLogsToPDF, exportAuditLogsToWord } from "@/lib/audit/audit-log-export"
import { HIDDEN_ACTIONS } from "@/lib/audit/audit-log-display"
import { logger } from "@/lib/logger"
import type { AuditLog, AuditLogFiltersState, EmployeeMember, UserProfile } from "./types"

// Re-export types consumed by page.tsx
export type { AuditLog, EmployeeMember, UserProfile }

const log = logger("audit-logs")

interface AdminAuditLogsContentProps {
  initialLogs: AuditLog[]
  initialTotalCount: number
  initialemployee: EmployeeMember[]
  initialDepartments: string[]
  userProfile: UserProfile
}

const DEFAULT_FILTERS: AuditLogFiltersState = {
  searchQuery: "",
  actionFilter: "all",
  entityFilter: "all",
  dateFilter: "all",
  departmentFilter: "all",
  employeeFilter: "all",
  customStartDate: "",
  customEndDate: "",
}

export function AdminAuditLogsContent({
  initialLogs,
  initialTotalCount,
  initialemployee,
  initialDepartments,
  userProfile,
}: AdminAuditLogsContentProps) {
  const scopedDepartments = useMemo(
    () => userProfile.managed_departments ?? userProfile.lead_departments ?? [],
    [userProfile.managed_departments, userProfile.lead_departments]
  )

  const [logs, setLogs] = useState<AuditLog[]>(initialLogs)
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount)
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFilters] = useState<AuditLogFiltersState>(DEFAULT_FILTERS)
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const employee = initialemployee
  const departments = initialDepartments
  const supabase = createClient()

  function handleFilterChange<K extends keyof AuditLogFiltersState>(key: K, value: AuditLogFiltersState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  // -------------------------------------------------------------------------
  // Client-side refresh (manual only — initial data comes from server props)
  // -------------------------------------------------------------------------
  const loadLogs = async () => {
    setIsLoading(true)
    try {
      const { count } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .not("action", "in", '("sync","migrate","update_schema","migration")')

      setTotalCount(count || 0)

      const { data: logsData, error: logsError } = await supabase
        .from("audit_logs")
        .select("*")
        .not("action", "in", '("sync","migrate","update_schema","migration")')
        .order("created_at", { ascending: false })
        .limit(500)

      if (logsError) {
        log.error("Audit logs error details:", logsError)
        if (logsError.message.includes("relation") && logsError.message.includes("does not exist")) {
          toast.error("Audit logs table not found. Please run the database migration first.")
        } else if (logsError.code === "PGRST301" || logsError.message.includes("permission")) {
          toast.error("Permission denied. You may not have access to view audit logs.")
        } else {
          toast.error(`Failed to load audit logs: ${logsError.message}`)
        }
        throw logsError
      }

      if (logsData && logsData.length > 0) {
        const userIdsSet = new Set(logsData.map((l) => l.user_id).filter(Boolean))
        const { data: usersData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, company_email, employee_number")
          .in("id", Array.from(userIdsSet))

        const usersMap = new Map(usersData?.map((u) => [u.id, u]))

        const mapped: AuditLog[] = logsData.map((l) => {
          const rawAction = l.action || l.operation?.toLowerCase() || "update"
          const action = normalizeAuditAction(rawAction).action
          const entity_type = l.entity_type || l.table_name || "unknown"
          const entity_id = l.record_id || l.entity_id
          const old_values = l.metadata?.old_values || l.old_values
          const new_values = l.metadata?.new_values || l.new_values
          return {
            id: l.id,
            user_id: l.user_id,
            action,
            entity_type,
            entity_id,
            old_values,
            new_values,
            metadata: l.metadata || {},
            created_at: l.created_at,
            user: l.user_id ? usersMap.get(l.user_id) || undefined : undefined,
          }
        })

        setLogs(mapped)
      } else {
        setLogs([])
      }
    } catch (error) {
      log.error("Error loading audit logs:", error)
      toast.error("Failed to refresh audit logs")
    } finally {
      setIsLoading(false)
    }
  }

  // -------------------------------------------------------------------------
  // Filtered view — pure derivation, no state
  // -------------------------------------------------------------------------
  const filteredLogs = useMemo(() => {
    const {
      searchQuery,
      actionFilter,
      entityFilter,
      dateFilter,
      departmentFilter,
      employeeFilter,
      customStartDate,
      customEndDate,
    } = filters

    return logs.filter((entry) => {
      const action = (entry.action || "unknown").toLowerCase()
      if (HIDDEN_ACTIONS.includes(action as (typeof HIDDEN_ACTIONS)[number])) return false

      const q = searchQuery.toLowerCase()
      const matchesSearch =
        (entry.entity_type || "").toLowerCase().includes(q) ||
        (entry.action || "").toLowerCase().includes(q) ||
        (typeof entry.metadata?.event === "string" ? entry.metadata.event.toLowerCase().includes(q) : false) ||
        (entry.user as { first_name?: string } | undefined)?.first_name?.toLowerCase().includes(q) ||
        (entry.user as { last_name?: string } | undefined)?.last_name?.toLowerCase().includes(q)

      const matchesAction = actionFilter === "all" || entry.action === actionFilter
      const matchesEntity = entityFilter === "all" || entry.entity_type === entityFilter

      let matchesDepartment = true
      if (userProfile?.is_department_lead) {
        if (scopedDepartments.length > 0) {
          const userDept = employee.find((s) => s.id === entry.user_id)?.department
          matchesDepartment = userDept ? scopedDepartments.includes(userDept) : false
        }
      } else {
        matchesDepartment =
          departmentFilter === "all" ||
          (entry.user ? employee.find((s) => s.id === entry.user_id)?.department === departmentFilter : false)
      }

      const matchesEmployee = employeeFilter === "all" || entry.user_id === employeeFilter

      let matchesDate = true
      if (dateFilter !== "all") {
        const logDate = new Date(entry.created_at)
        const now = new Date()
        const daysDiff = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))
        switch (dateFilter) {
          case "today":
            matchesDate = daysDiff === 0
            break
          case "week":
            matchesDate = daysDiff <= 7
            break
          case "month":
            matchesDate = daysDiff <= 30
            break
          case "custom":
            if (customStartDate && customEndDate) {
              const start = new Date(customStartDate)
              const end = new Date(customEndDate)
              end.setHours(23, 59, 59, 999)
              matchesDate = logDate >= start && logDate <= end
            } else if (customStartDate) {
              matchesDate = logDate >= new Date(customStartDate)
            } else if (customEndDate) {
              const end = new Date(customEndDate)
              end.setHours(23, 59, 59, 999)
              matchesDate = logDate <= end
            }
            break
        }
      }

      return matchesSearch && matchesAction && matchesEntity && matchesDate && matchesDepartment && matchesEmployee
    })
  }, [logs, filters, userProfile, employee, scopedDepartments])

  const stats = useMemo(
    () => ({
      total: totalCount,
      creates: logs.filter((l) => l.action === "create").length,
      updates: logs.filter((l) => l.action === "update").length,
      deletes: logs.filter((l) => l.action === "delete").length,
    }),
    [logs, totalCount]
  )

  return (
    <AdminTablePage
      title="Audit Logs"
      description="Complete audit trail of all system activities"
      icon={ScrollText}
      actions={
        <div className="flex items-center rounded-lg border p-1">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-1 sm:gap-2"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </Button>
          <Button
            variant={viewMode === "card" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("card")}
            className="gap-1 sm:gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Card</span>
          </Button>
        </div>
      }
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
          {[
            { label: "Total Actions", value: stats.total, color: "blue" },
            { label: "Creates", value: stats.creates, color: "green" },
            { label: "Updates", value: stats.updates, color: "blue" },
            { label: "Deletes", value: stats.deletes, color: "red" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border-2">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">{label}</p>
                    <p className="text-foreground mt-1 text-lg font-bold sm:mt-2 sm:text-3xl">{value}</p>
                  </div>
                  <div className={`rounded-lg bg-${color}-100 p-3 dark:bg-${color}-900/30`}>
                    <ScrollText className={`h-6 w-6 text-${color}-600 dark:text-${color}-400`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      }
      filters={
        <AuditLogFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          employee={employee}
          departments={departments}
          userProfile={userProfile}
          scopedDepartments={scopedDepartments}
        />
      }
      filtersInCard={false}
    >
      {/* Export bar */}
      <Card className="border-2">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Download className="text-muted-foreground h-4 w-4" />
              <span className="text-foreground text-sm font-medium">Export Filtered Data:</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAuditLogsToExcel(filteredLogs)}
                className="gap-2"
                disabled={filteredLogs.length === 0 || isLoading}
              >
                <FileText className="h-4 w-4" />
                Excel (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAuditLogsToPDF(filteredLogs)}
                className="gap-2"
                disabled={filteredLogs.length === 0 || isLoading}
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAuditLogsToWord(filteredLogs)}
                className="gap-2"
                disabled={filteredLogs.length === 0 || isLoading}
              >
                <FileText className="h-4 w-4" />
                Word (.docx)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log list or cards */}
      {filteredLogs.length > 0 ? (
        viewMode === "list" ? (
          <AuditLogTable
            logs={filteredLogs}
            onViewDetails={(l) => {
              setSelectedLog(l)
              setIsDetailsOpen(true)
            }}
          />
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((l) => (
              <AuditLogCard
                key={l.id}
                log={l}
                onViewDetails={(entry) => {
                  setSelectedLog(entry)
                  setIsDetailsOpen(true)
                }}
              />
            ))}
          </div>
        )
      ) : (
        <Card className="border-2">
          <CardContent className="p-12 text-center">
            <ScrollText className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
            <h3 className="text-foreground mb-2 text-xl font-semibold">No Audit Logs Found</h3>
            <p className="text-muted-foreground">
              {Object.entries(filters).some(
                ([k, v]) => k !== "customStartDate" && k !== "customEndDate" && v !== "all" && v !== ""
              )
                ? "No logs match your filters"
                : "No audit logs available yet"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {filteredLogs.length > 0 && (
        <div className="text-muted-foreground text-center text-sm">
          Showing {filteredLogs.length} of {totalCount} total logs
          {totalCount > logs.length && ` (limited to last ${logs.length} entries)`}
        </div>
      )}

      {/* Detail dialog */}
      <AuditLogDetailPanel log={selectedLog} open={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} />
    </AdminTablePage>
  )

  // expose for manual refresh button if needed
  void loadLogs
}
