"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Building2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ScrollText, Search, Filter, Calendar, User, FileText, LayoutGrid, List, Eye, Download } from "lucide-react"
import { formatName } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { AdminTablePage } from "@/components/admin/admin-table-page"

export interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id?: string
  old_values?: any
  new_values?: any
  created_at: string
  department?: string | null
  changed_fields?: string[]
  user?: {
    first_name: string
    last_name: string
    company_email: string
    employee_number?: string
  }
  target_user?: {
    first_name: string
    last_name: string
    company_email: string
    employee_number?: string
  }
  task_info?: {
    title: string
    assigned_to?: string
    assigned_to_user?: {
      first_name: string
      last_name: string
    }
  }
  device_info?: {
    device_name: string
    assigned_to?: string
    assigned_to_user?: {
      first_name: string
      last_name: string
    }
  }
  asset_info?: {
    asset_name: string
    unique_code?: string
    serial_number?: string
    assignment_type?: string
    assigned_to?: string
    assigned_to_user?: {
      first_name: string
      last_name: string
    }
  }
  payment_info?: {
    title: string
    amount: number
    currency: string
    department_name?: string
  }
  document_info?: {
    file_name: string
    document_type: string
    department_name?: string
  }
  department_info?: {
    name: string
  }
  category_info?: {
    name: string
  }
  leave_request_info?: {
    user_id: string
    leave_type_name: string
    requester_user?: {
      first_name: string
      last_name: string
    }
  }
}

export interface employeeMember {
  id: string
  first_name: string
  last_name: string
  department: string
}

export interface UserProfile {
  role: string
  lead_departments?: string[]
  managed_departments?: string[]
}

interface AdminAuditLogsContentProps {
  initialLogs: AuditLog[]
  initialemployee: employeeMember[]
  initialDepartments: string[]
  userProfile: UserProfile
}

export function AdminAuditLogsContent({
  initialLogs,
  initialemployee,
  initialDepartments,
  userProfile,
}: AdminAuditLogsContentProps) {
  const scopedDepartments = userProfile.managed_departments ?? userProfile.lead_departments ?? []
  // Actions to hide from display (system/internal operations)
  const HIDDEN_ACTIONS = ["sync", "migrate", "update_schema", "migration"]

  const [logs, setLogs] = useState<AuditLog[]>(initialLogs)
  const [employee] = useState<employeeMember[]>(initialemployee)
  const [departments] = useState<string[]>(initialDepartments)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [employeeFilter, setemployeeFilter] = useState("all")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const supabase = createClient()

  // Initial data is provided via props from server component
  // loadLogs() is available for explicit refresh only - no auto-refetch on mount

  // Initial data is now provided via props from server component
  // loadLogs is still available for client-side refresh if needed

  const loadLogs = async () => {
    setIsLoading(true)
    try {
      // Fetch audit logs without join first
      const { data: logsData, error: logsError } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500)

      if (logsError) {
        console.error("Audit logs error details:", logsError)

        // Check if table doesn't exist
        if (logsError.message.includes("relation") && logsError.message.includes("does not exist")) {
          toast.error("Audit logs table not found. Please run the database migration first.")
        } else if (logsError.code === "PGRST301" || logsError.message.includes("permission")) {
          toast.error("Permission denied. You may not have access to view audit logs.")
        } else {
          toast.error(`Failed to load audit logs: ${logsError.message}`)
        }
        throw logsError
      }

      // If we have logs, fetch user details for each unique user_id and entity_id
      if (logsData && logsData.length > 0) {
        // Fetch users who performed actions
        const userIdsSet = new Set(logsData.map((log) => log.user_id).filter(Boolean))
        const uniqueUserIds = Array.from(userIdsSet)

        // Separate entity IDs by type
        // Get entity_type from table_name (new schema) or entity_type (old schema)
        const getEntityType = (log: any) => log.table_name || log.entity_type || "unknown"

        const userEntityIds = new Set(
          logsData
            .filter((log) => {
              const entityType = getEntityType(log)
              return (
                log.entity_id &&
                (entityType === "profile" ||
                  entityType === "profiles" ||
                  entityType === "user" ||
                  entityType === "pending_user" ||
                  entityType === "admin_action")
              )
            })
            .map((log) => log.entity_id)
            .filter(Boolean)
        )

        const taskEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => {
                const entityType = getEntityType(log)
                return log.entity_id && (entityType === "task" || entityType === "tasks")
              })
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const deviceEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => {
                const entityType = getEntityType(log)
                return (
                  log.entity_id &&
                  (entityType === "device" ||
                    entityType === "devices" ||
                    entityType === "device_assignment" ||
                    entityType === "device_assignments")
                )
              })
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const assetEntityIds = Array.from(
          new Set(
            logsData
              .flatMap((log) => {
                const entityType = getEntityType(log)
                const isAsset =
                  entityType === "asset" ||
                  entityType === "assets" ||
                  entityType === "asset_assignment" ||
                  entityType === "asset_assignments"
                if (!isAsset) return []

                const ids = []
                if (log.entity_id) ids.push(log.entity_id)

                // Also extract asset_id from metadata if it's an assignment log
                if (entityType === "asset_assignment" || entityType === "asset_assignments") {
                  const metadata = log.metadata || {}
                  const newValues = metadata.new_values || log.new_values
                  const oldValues = metadata.old_values || log.old_values
                  if (newValues?.asset_id) ids.push(newValues.asset_id)
                  if (ids.length === 0 && oldValues?.asset_id) ids.push(oldValues.asset_id)
                }

                return ids
              })
              .filter(Boolean)
          )
        )

        const paymentEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => {
                const entityType = getEntityType(log)
                return log.entity_id && entityType === "department_payments"
              })
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const documentEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => {
                const entityType = getEntityType(log)
                return log.entity_id && entityType === "payment_documents"
              })
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const departmentEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => {
                const entityType = getEntityType(log)
                return log.entity_id && entityType === "departments"
              })
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const categoryEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => {
                const entityType = getEntityType(log)
                return log.entity_id && entityType === "payment_categories"
              })
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        // Leave request entity IDs (for leave_requests and leave_approvals)
        const leaveRequestEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => {
                const entityType = getEntityType(log)
                return log.entity_id && entityType === "leave_requests"
              })
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const leaveApprovalEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => {
                const entityType = getEntityType(log)
                return log.entity_id && entityType === "leave_approvals"
              })
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        // 3. Fetch all potential users (actors, targets, and assignees)
        const userIdsFromMetadata = logsData
          .flatMap((log: any) => {
            const metadata = log.metadata || {}
            const newValues = metadata.new_values || log.new_values
            const oldValues = metadata.old_values || log.old_values
            return [
              newValues?.assigned_to,
              newValues?.target_user_id,
              newValues?.user_id,
              oldValues?.assigned_to,
              // If it's a profile log, the ID itself is a user ID
              log.table_name === "profiles" || log.table_name === "user" || log.entity_type === "profiles"
                ? log.record_id || log.entity_id
                : null,
            ]
          })
          .filter((id: string | null) => id && typeof id === "string" && id.length === 36)

        const initialUserIds = Array.from(
          new Set([...uniqueUserIds, ...(Array.from(userEntityIds) as string[]), ...userIdsFromMetadata])
        )

        const { data: initialUsersData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, company_email, employee_number")
          .in("id", initialUserIds)

        const usersMap = new Map(initialUsersData?.map((user) => [user.id, user]))

        // 4. Fetch related entities with complete state
        let tasksMap = new Map()
        if (taskEntityIds.length > 0) {
          const { data: tasksData } = await supabase
            .from("tasks")
            .select("id, title, assigned_to")
            .in("id", taskEntityIds)
          if (tasksData) {
            tasksMap = new Map(
              tasksData.map((t) => [
                t.id,
                {
                  title: t.title,
                  assigned_to: t.assigned_to,
                  assigned_to_user: t.assigned_to ? usersMap.get(t.assigned_to) : null,
                },
              ])
            )
          }
        }

        let devicesMap = new Map()
        if (deviceEntityIds.length > 0) {
          const { data: devicesData } = await supabase
            .from("devices")
            .select("id, device_name")
            .in("id", deviceEntityIds)
          if (devicesData) {
            devicesMap = new Map(devicesData.map((d) => [d.id, { device_name: d.device_name }]))
          }
        }

        let assetsMap = new Map()
        if (assetEntityIds.length > 0) {
          const { data: assetsData } = await supabase
            .from("assets")
            .select("id, asset_name, unique_code, serial_number, assignment_type")
            .in("id", assetEntityIds)

          if (assetsData) {
            // Fetch ALL assignments for these assets
            const { data: assignmentsData } = await supabase
              .from("asset_assignments")
              .select("asset_id, assigned_to, assignment_type, created_at")
              .in("asset_id", assetEntityIds)
              .order("created_at", { ascending: false })

            const assetLatestAssignmentMap = new Map()
            const assignmentUserIds = new Set<string>()

            if (assignmentsData) {
              assignmentsData.forEach((a) => {
                if (!assetLatestAssignmentMap.has(a.asset_id)) {
                  assetLatestAssignmentMap.set(a.asset_id, a)
                  if (a.assigned_to) assignmentUserIds.add(a.assigned_to)
                }
              })
            }

            // Fetch any users found in assignments that weren't in the initial set
            const missingIds = Array.from(assignmentUserIds).filter((id) => !usersMap.has(id))
            if (missingIds.length > 0) {
              const { data: moreUsers } = await supabase
                .from("profiles")
                .select("id, first_name, last_name, company_email, employee_number")
                .in("id", missingIds)
              moreUsers?.forEach((u) => usersMap.set(u.id, u))
            }

            assetsMap = new Map(
              assetsData.map((asset) => {
                const assignment = assetLatestAssignmentMap.get(asset.id)
                const assignedTo = assignment?.assigned_to
                return [
                  asset.id,
                  {
                    asset_name: asset.asset_name,
                    unique_code: asset.unique_code,
                    serial_number: asset.serial_number,
                    assignment_type: asset.assignment_type || assignment?.assignment_type,
                    assigned_to: assignedTo,
                    assigned_to_user: assignedTo ? usersMap.get(assignedTo) : null,
                  },
                ]
              })
            )
          }
        }

        // Fetch payments with department names
        let paymentsMap = new Map()
        if (paymentEntityIds.length > 0) {
          const { data: paymentsData } = await supabase
            .from("department_payments")
            .select("id, title, amount, currency, department:departments(name)")
            .in("id", paymentEntityIds)

          if (paymentsData) {
            paymentsMap = new Map(
              paymentsData.map((p: any) => [
                p.id,
                {
                  ...p,
                  department_name: p.department?.name,
                },
              ])
            )
          }
        }

        // Fetch documents with department names (via payments)
        let documentsMap = new Map()
        if (documentEntityIds.length > 0) {
          const { data: documentsData } = await supabase
            .from("payment_documents")
            .select("id, file_name, document_type, payment:department_payments(department:departments(name))")
            .in("id", documentEntityIds)

          if (documentsData) {
            documentsMap = new Map(
              documentsData.map((d: any) => [
                d.id,
                {
                  ...d,
                  department_name: d.payment?.department?.name,
                },
              ])
            )
          }
        }

        // 5. Collect all department IDs referenced in metadata (for finance logs etc)
        const metadataDeptIds = logsData
          .flatMap((log: any) => {
            const nv = log.metadata?.new_values || log.new_values
            const ov = log.metadata?.old_values || log.old_values
            return [nv?.department_id, ov?.department_id, nv?.department, ov?.department]
          })
          .filter((id: any) => id && typeof id === "string" && id.length === 36)

        const allDeptIds = Array.from(new Set([...departmentEntityIds, ...metadataDeptIds])) as string[]

        let departmentsMap = new Map()
        if (allDeptIds.length > 0) {
          const { data: departmentsData } = await supabase.from("departments").select("id, name").in("id", allDeptIds)

          if (departmentsData) {
            departmentsMap = new Map(departmentsData.map((d) => [d.id, d]))
          }
        }

        // Fetch categories if needed
        let categoriesMap = new Map()
        if (categoryEntityIds.length > 0) {
          const { data: categoriesData } = await supabase
            .from("payment_categories")
            .select("id, name")
            .in("id", categoryEntityIds)

          if (categoriesData) {
            categoriesMap = new Map(categoriesData.map((c) => [c.id, c]))
          }
        }

        // Fetch leave requests if needed
        let leaveRequestsMap = new Map()
        if (leaveRequestEntityIds.length > 0 || leaveApprovalEntityIds.length > 0) {
          // Get leave request IDs from approvals
          let approvalRequestIds: string[] = []
          if (leaveApprovalEntityIds.length > 0) {
            const { data: approvalsData } = await supabase
              .from("leave_approvals")
              .select("id, leave_request_id")
              .in("id", leaveApprovalEntityIds)

            if (approvalsData) {
              approvalRequestIds = approvalsData.map((a) => a.leave_request_id).filter(Boolean)
            }
          }

          const allLeaveRequestIds = Array.from(new Set([...leaveRequestEntityIds, ...approvalRequestIds]))

          if (allLeaveRequestIds.length > 0) {
            const { data: leaveData } = await supabase
              .from("leave_requests")
              .select("id, user_id, leave_type:leave_types(name)")
              .in("id", allLeaveRequestIds)

            if (leaveData) {
              // Fetch requester profiles
              const requesterIds = Array.from(new Set(leaveData.map((l) => l.user_id).filter(Boolean)))
              let requesterMap = new Map()
              if (requesterIds.length > 0) {
                const { data: requesterData } = await supabase
                  .from("profiles")
                  .select("id, first_name, last_name")
                  .in("id", requesterIds)
                requesterMap = new Map(requesterData?.map((u) => [u.id, u]) || [])
              }

              leaveRequestsMap = new Map(
                leaveData.map((l) => [
                  l.id,
                  {
                    user_id: l.user_id,
                    leave_type_name: (l.leave_type as any)?.name || "Leave",
                    requester_user: requesterMap.get(l.user_id),
                  },
                ])
              )

              // Also map approval IDs to leave request info
              if (leaveApprovalEntityIds.length > 0) {
                const { data: approvalsData } = await supabase
                  .from("leave_approvals")
                  .select("id, leave_request_id")
                  .in("id", leaveApprovalEntityIds)

                approvalsData?.forEach((approval) => {
                  const leaveInfo = leaveRequestsMap.get(approval.leave_request_id)
                  if (leaveInfo) {
                    leaveRequestsMap.set(approval.id, leaveInfo)
                  }
                })
              }
            }
          }
        }

        // Combine logs with all fetched data
        // Map database columns to UI interface
        const logsWithUsers = logsData.map((log: any) => {
          // Map database columns to UI interface
          // IMPORTANT: Use action (semantic: create/update/delete) not operation (raw SQL: INSERT/UPDATE/DELETE)
          const action = log.action || log.operation?.toLowerCase() || "unknown"
          const entity_type = log.entity_type || log.table_name || "unknown"
          const entity_id = log.record_id || log.entity_id
          const old_values = log.metadata?.old_values || log.old_values
          const new_values = log.metadata?.new_values || log.new_values

          // Determine target_user based on entity type
          // For assignments (asset/device/task), look up the assigned_to user
          // For user-related entities (profile/pending_user), entity_id is the user ID
          let target_user = null

          if (
            entity_type === "asset" ||
            entity_type === "assets" ||
            entity_type === "asset_assignment" ||
            entity_type === "asset_assignments" ||
            entity_type === "device" ||
            entity_type === "devices" ||
            entity_type === "device_assignment" ||
            entity_type === "device_assignments" ||
            entity_type === "task" ||
            entity_type === "tasks"
          ) {
            if (new_values?.assigned_to) {
              target_user = usersMap.get(new_values.assigned_to) || null
            } else if (
              entity_type === "asset" ||
              entity_type === "assets" ||
              entity_type === "asset_assignment" ||
              entity_type === "asset_assignments"
            ) {
              // Fallback to related asset's current/latest assignee for ANY asset log
              const aid =
                entity_type === "asset_assignment" || entity_type === "asset_assignments"
                  ? new_values?.asset_id || old_values?.asset_id
                  : entity_id
              const assetInfo = aid ? assetsMap.get(aid) : null
              if (assetInfo?.assigned_to) {
                target_user = usersMap.get(assetInfo.assigned_to) || null
              }
            }
          } else if (
            entity_type === "profile" ||
            entity_type === "profiles" ||
            entity_type === "user" ||
            entity_type === "pending_user"
          ) {
            // For user-related entities, entity_id should be the user ID
            target_user = entity_id ? usersMap.get(entity_id) : null
          }

          // ENRICHMENT: Inject human-readable labels into the JSON blobs for the details view
          let enrichedNewValues = new_values ? { ...new_values } : null
          let enrichedOldValues = old_values ? { ...old_values } : null

          // 1. Resolve Department Name
          let dName = null
          const dId =
            new_values?.department_id || old_values?.department_id || new_values?.department || old_values?.department

          if (dId && typeof dId === "string" && dId.length === 36) {
            dName = departmentsMap.get(dId)?.name
          }

          // Special fallback for Finance/Payment logs (lookup the parent payment)
          if (!dName && (entity_type === "department_payments" || entity_type === "payment_documents")) {
            const pid =
              entity_type === "department_payments" ? entity_id : new_values?.payment_id || old_values?.payment_id
            dName = pid ? paymentsMap.get(pid)?.department_name : null
          }

          if (dName) {
            if (enrichedNewValues) enrichedNewValues.department = dName
            if (enrichedOldValues) enrichedOldValues.department = dName
          }

          // 2. Resolve target person name if it's an ID
          const targetId =
            new_values?.assigned_to ||
            old_values?.assigned_to ||
            new_values?.user_id ||
            old_values?.user_id ||
            new_values?.target_user_id ||
            old_values?.target_user_id
          if (targetId && typeof targetId === "string" && targetId.length === 36) {
            const u = usersMap.get(targetId)
            if (u) {
              const uName = `${u.first_name} ${u.last_name}`
              if (enrichedNewValues) enrichedNewValues.assigned_to_name = uName
              if (enrichedOldValues) enrichedOldValues.assigned_to_name = uName
            }
          }

          return {
            id: log.id,
            user_id: log.user_id,
            action,
            entity_type,
            entity_id,
            old_values: enrichedOldValues,
            new_values: enrichedNewValues,
            created_at: log.created_at,
            user: log.user_id ? usersMap.get(log.user_id) : null,
            target_user,
            task_info:
              entity_id && (entity_type === "task" || entity_type === "tasks") ? tasksMap.get(entity_id) : null,
            device_info:
              entity_id &&
              (entity_type === "device" ||
                entity_type === "devices" ||
                entity_type === "device_assignment" ||
                entity_type === "device_assignments")
                ? devicesMap.get(entity_id)
                : null,
            asset_info: (() => {
              if (
                entity_type === "asset" ||
                entity_type === "assets" ||
                entity_type === "asset_assignment" ||
                entity_type === "asset_assignments"
              ) {
                // If it's an assignment log, use the asset_id from metadata
                const aid =
                  entity_type === "asset_assignment" || entity_type === "asset_assignments"
                    ? new_values?.asset_id || old_values?.asset_id
                    : entity_id
                return aid ? assetsMap.get(aid) : null
              }
              return null
            })(),
            payment_info: entity_id && entity_type === "department_payments" ? paymentsMap.get(entity_id) : null,
            document_info: entity_id && entity_type === "payment_documents" ? documentsMap.get(entity_id) : null,
            department_info: (() => {
              // Priority 1: Direct department entity
              if (entity_type === "departments") return departmentsMap.get(entity_id)
              // Priority 2: Department ID in metadata (Common for finance/asset logs)
              const deptId =
                new_values?.department_id ||
                old_values?.department_id ||
                new_values?.department ||
                old_values?.department
              if (deptId && typeof deptId === "string" && deptId.length === 36) {
                return departmentsMap.get(deptId)
              }
              // Priority 3: Payment/Asset info department
              if (entity_type === "department_payments")
                return paymentsMap.get(entity_id)?.department_name
                  ? { name: paymentsMap.get(entity_id).department_name }
                  : null
              return null
            })(),
            category_info: entity_id && entity_type === "payment_categories" ? categoriesMap.get(entity_id) : null,
            leave_request_info:
              entity_id && (entity_type === "leave_requests" || entity_type === "leave_approvals")
                ? leaveRequestsMap.get(entity_id)
                : null,
          }
        })

        console.log("Loaded audit logs count:", logsWithUsers.length)
        setLogs(logsWithUsers as any)
      } else {
        console.log("No audit logs found")
        setLogs([])
      }
    } catch (error: any) {
      console.error("Error loading audit logs:", error)
      toast.error("Failed to refresh audit logs")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredLogs = logs.filter((log) => {
    // Filter out system/internal actions
    const action = (log.action || "unknown").toLowerCase()
    if (HIDDEN_ACTIONS.includes(action)) {
      return false
    }

    const normalizedQuery = searchQuery.toLowerCase()
    const matchesSearch =
      (log.entity_type || "").toLowerCase().includes(normalizedQuery) ||
      (log.action || "").toLowerCase().includes(normalizedQuery) ||
      (log.user as any)?.first_name?.toLowerCase().includes(normalizedQuery) ||
      (log.user as any)?.last_name?.toLowerCase().includes(normalizedQuery)

    const matchesAction = actionFilter === "all" || log.action === actionFilter
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter

    // Filter by department - for leads, always filter by their departments
    let matchesDepartment = true
    if (userProfile?.role === "lead") {
      // Leads: logs are already filtered, but ensure they match lead's departments
      if (scopedDepartments.length > 0) {
        const userDept = employee.find((s) => s.id === log.user_id)?.department
        matchesDepartment = userDept ? scopedDepartments.includes(userDept) : false
      }
    } else {
      // Admins: use department filter
      matchesDepartment =
        departmentFilter === "all" ||
        (log.user ? employee.find((s) => s.id === log.user_id)?.department === departmentFilter : false)
    }

    // Filter by employee
    const matchesemployee = employeeFilter === "all" || log.user_id === employeeFilter

    let matchesDate = true
    if (dateFilter !== "all") {
      const logDate = new Date(log.created_at)
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
            const startDate = new Date(customStartDate)
            const endDate = new Date(customEndDate)
            // Set end date to end of day
            endDate.setHours(23, 59, 59, 999)
            matchesDate = logDate >= startDate && logDate <= endDate
          } else if (customStartDate) {
            const startDate = new Date(customStartDate)
            matchesDate = logDate >= startDate
          } else if (customEndDate) {
            const endDate = new Date(customEndDate)
            endDate.setHours(23, 59, 59, 999)
            matchesDate = logDate <= endDate
          }
          break
      }
    }

    return matchesSearch && matchesAction && matchesEntity && matchesDate && matchesDepartment && matchesemployee
  })

  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "update":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "delete":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "assign":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  // Normalize entity types to consistent categories for display
  const getNormalizedEntityType = (entityType: string): string => {
    const type = (entityType || "unknown").toLowerCase()

    // Assets category
    if (type === "asset" || type === "assets" || type === "asset_assignment" || type === "asset_assignments") {
      return "Assets"
    }

    // Employee category
    if (
      type === "profile" ||
      type === "profiles" ||
      type === "user" ||
      type === "pending_user" ||
      type === "admin_action"
    ) {
      return "Employees"
    }

    // Tasks category
    if (type === "task" || type === "tasks" || type === "task_assignment" || type === "task_assignments") {
      return "Tasks"
    }

    // Projects category
    if (type === "project" || type === "projects" || type === "project_members" || type === "project_updates") {
      return "Projects"
    }

    // Finance category
    if (
      type === "department_payments" ||
      type === "payment_documents" ||
      type === "payment_categories" ||
      type === "starlink_payments"
    ) {
      return "Finance"
    }

    // Leave/HR category
    if (type === "leave_requests" || type === "leave_approvals" || type === "leave_balances") {
      return "Leave"
    }

    // Departments category
    if (type === "departments" || type === "department") {
      return "Departments"
    }

    // Feedback category
    if (type === "feedback") {
      return "Feedback"
    }

    // Documentation
    if (type === "user_documentation" || type === "documentation") {
      return "Documentation"
    }

    // Devices (legacy)
    if (type === "device" || type === "devices" || type === "device_assignment" || type === "device_assignments") {
      return "Devices"
    }

    // Management/Sync
    if (type === "management") {
      return "System"
    }

    // Default - capitalize the type
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Get the "performed by" text - show Anonymous for anonymous feedback
  const getPerformedBy = (log: AuditLog): string => {
    // Check if this is anonymous feedback
    if (log.entity_type === "feedback" && log.new_values?.is_anonymous) {
      return "Anonymous"
    }
    // Normal case - show user name
    if (log.user) {
      return `${formatName(log.user.first_name)} ${formatName(log.user.last_name)}`
    }
    return "N/A"
  }

  // Get the unique identifier/code for the object (new Object column)
  const getObjectIdentifier = (log: AuditLog): string => {
    const entityType = (log.entity_type || "unknown").toLowerCase()

    // Assets - Priotitize unique_code (NO serial number)
    if (
      entityType === "asset" ||
      entityType === "assets" ||
      entityType === "asset_assignment" ||
      entityType === "asset_assignments"
    ) {
      // 1. Priority: Unique Code (from database lookup or log metadata)
      const uniqueCode =
        log.asset_info?.unique_code ||
        log.new_values?.unique_code ||
        log.old_values?.unique_code ||
        log.new_values?.asset_code ||
        log.old_values?.asset_code

      if (uniqueCode && uniqueCode !== "-" && uniqueCode !== "null" && uniqueCode !== "") {
        return uniqueCode
      }

      // 2. Fallback: Asset Name only (NO serial number display)
      const assetName = log.asset_info?.asset_name || log.new_values?.asset_name || log.old_values?.asset_name

      if (assetName) return assetName

      return "-"
    }

    // Employees - show employee_number or company_email
    if (
      entityType === "profile" ||
      entityType === "profiles" ||
      entityType === "user" ||
      entityType === "pending_user" ||
      entityType === "admin_action"
    ) {
      const employeeNumber =
        log.new_values?.employee_number || log.old_values?.employee_number || log.target_user?.employee_number
      if (employeeNumber) return employeeNumber

      const companyEmail =
        log.new_values?.company_email || log.old_values?.company_email || log.target_user?.company_email
      if (companyEmail) return companyEmail.split("@")[0] // Just the username part

      // Fallback to name if ID is the same as entity_id (which usually means we're acting on this user)
      if (log.target_user) return `${formatName(log.target_user.first_name)} ${formatName(log.target_user.last_name)}`

      return "-"
    }

    // Tasks - show task title
    if (entityType === "task" || entityType === "tasks") {
      const title = log.new_values?.title || log.old_values?.title || log.task_info?.title
      if (title) return title.length > 30 ? title.substring(0, 30) + "..." : title
      return "-"
    }

    // Finance/Payments - show payment title as the object
    if (entityType === "department_payments") {
      const title =
        log.new_values?.title || log.old_values?.title || log.payment_info?.title || log.new_values?.payment_reference
      if (title) return title.length > 50 ? title.substring(0, 50) + "..." : title
      return "-"
    }

    // Payment Documents - show file name as the object
    if (entityType === "payment_documents") {
      const fileName = log.new_values?.file_name || log.old_values?.file_name || log.document_info?.file_name
      if (fileName) return fileName.length > 50 ? fileName.substring(0, 50) + "..." : fileName
      return "-"
    }

    // Devices - show device name or serial
    if (
      entityType === "device" ||
      entityType === "devices" ||
      entityType === "device_assignment" ||
      entityType === "device_assignments"
    ) {
      const deviceName = log.new_values?.device_name || log.old_values?.device_name || log.device_info?.device_name
      if (deviceName) return deviceName
      return "-"
    }

    // Leave - show leave type
    if (entityType === "leave_requests" || entityType === "leave_approvals") {
      if (log.leave_request_info?.leave_type_name) return log.leave_request_info.leave_type_name
      return "-"
    }

    // Departments - show department name
    if (entityType === "departments") {
      const name = log.new_values?.name || log.old_values?.name || log.department_info?.name
      if (name) return name
      return "-"
    }

    // Feedback - show feedback type
    if (entityType === "feedback") {
      const feedbackType = log.new_values?.feedback_type || log.old_values?.feedback_type
      if (feedbackType) return feedbackType.charAt(0).toUpperCase() + feedbackType.slice(1)
      return "-"
    }

    // Default
    return "-"
  }

  const getTargetDescription = (log: AuditLog) => {
    const action = (log.action || "unknown").toLowerCase()
    const entityType = (log.entity_type || "unknown").toLowerCase()

    // Handle asset-related logs - PRIORITIZE PERSON NAME
    if (
      entityType === "asset" ||
      entityType === "assets" ||
      entityType === "asset_assignment" ||
      entityType === "asset_assignments"
    ) {
      // 1. Find the person's name (actor, target, or assignee)
      const personName = (() => {
        // Check pre-populated target user
        if (log.target_user?.first_name) {
          return `${formatName(log.target_user.first_name)} ${formatName(log.target_user.last_name)}`
        }
        // REMOVED: Fallback to current asset owner. This causes historical logs to show current owner.
        // If target_user is null, it means the log didn't capture a target. Better to show nothing than wrong info.
        // Check for direct name in metadata
        if (log.new_values?.assigned_to_name) return log.new_values.assigned_to_name
        return null
      })()

      // If we found a human, ALWAYS return the human name
      if (personName) return personName

      // Check assignment type to prevent misleading "Department" target for individual assignments
      const assignmentType =
        log.new_values?.assignment_type ||
        log.old_values?.assignment_type ||
        log.asset_info?.assignment_type ||
        (log.new_values?.assigned_to || log.old_values?.assigned_to ? "individual" : null)

      // If it is explicitly an individual assignment but we couldn't find the name,
      // return "-" instead of falling back to department, which would confuse it with a department assignment.
      if (assignmentType === "individual") return "-"

      // 2. Fallback: Department or Office
      const dept = log.new_values?.department || log.old_values?.department
      if (dept) return `${dept} (Dept)`

      const location = log.new_values?.office_location || log.old_values?.office_location
      if (location) return `${location} (Location)`

      return "-"
    }

    // Handle task-related logs
    if (entityType === "task" || entityType === "tasks") {
      if (log.task_info?.assigned_to_user) {
        return `${formatName(log.task_info.assigned_to_user.first_name)} ${formatName(log.task_info.assigned_to_user.last_name)}`
      }
      if (log.target_user) {
        return `${formatName(log.target_user.first_name)} ${formatName(log.target_user.last_name)}`
      }
      return "-"
    }

    // Handle device-related logs
    if (
      entityType === "device" ||
      entityType === "devices" ||
      entityType === "device_assignment" ||
      entityType === "device_assignments"
    ) {
      if (log.device_info?.assigned_to_user) {
        return `${formatName(log.device_info.assigned_to_user.first_name)} ${formatName(log.device_info.assigned_to_user.last_name)}`
      }
      if (log.target_user) {
        return `${formatName(log.target_user.first_name)} ${formatName(log.target_user.last_name)}`
      }
      return "-"
    }

    // Handle user/employee-related logs - show the employee name
    if (
      entityType === "profile" ||
      entityType === "profiles" ||
      entityType === "user" ||
      entityType === "pending_user" ||
      entityType === "admin_action"
    ) {
      // Check target_user
      if (log.target_user) {
        return `${formatName(log.target_user.first_name)} ${formatName(log.target_user.last_name)}`
      }
      // Check new_values for user data
      if (log.new_values?.first_name && log.new_values?.last_name) {
        return `${formatName(log.new_values.first_name)} ${formatName(log.new_values.last_name)}`
      }
      // Check for target_user_id in admin_action
      if (entityType === "admin_action" && log.new_values?.target_user_id) {
        return "-" // We don't have the lookup, show dash
      }
      return "-"
    }

    // Handle Leave Requests - show requester's name
    if (entityType === "leave_requests") {
      if (log.leave_request_info?.requester_user) {
        const name = `${formatName(log.leave_request_info.requester_user.first_name)} ${formatName(log.leave_request_info.requester_user.last_name)}`
        return name
      }
      if (log.target_user) {
        return `${formatName(log.target_user.first_name)} ${formatName(log.target_user.last_name)}`
      }
      return "-"
    }

    // Handle Leave Approvals
    if (entityType === "leave_approvals") {
      if (log.leave_request_info?.requester_user) {
        return `${formatName(log.leave_request_info.requester_user.first_name)} ${formatName(log.leave_request_info.requester_user.last_name)}`
      }
      return "-"
    }

    // Handle Payments/Finance - show receiving department
    if (entityType === "department_payments" || entityType === "payment_documents") {
      const deptName =
        log.department_info?.name ||
        log.payment_info?.department_name ||
        log.new_values?.department_name ||
        log.new_values?.department ||
        log.old_values?.department
      if (deptName && typeof deptName === "string") return deptName
      return "-"
    }

    // Handle Departments - show department name
    if (entityType === "departments") {
      if (log.department_info) return log.department_info.name
      const name = log.new_values?.name || log.old_values?.name
      if (name) return name
      return "-"
    }

    // Handle Payment Categories
    if (entityType === "payment_categories") {
      return "-"
    }

    // Handle Feedback
    if (entityType === "feedback") {
      if (log.user && !log.new_values?.is_anonymous) {
        return `${formatName(log.user.first_name)} ${formatName(log.user.last_name)}`
      }
      return log.new_values?.is_anonymous ? "Anonymous" : "-"
    }

    // Handle Documentation
    if (entityType === "user_documentation" || entityType === "documentation") {
      if (log.user) {
        return `${formatName(log.user.first_name)} ${formatName(log.user.last_name)}`
      }
      return "-"
    }

    // Handle Management/System
    if (entityType === "management") {
      return "-"
    }

    // Default fallback
    return "-"
  }

  // Get department or office location for the log entry
  const getDepartmentLocation = (log: AuditLog): string => {
    // First check the dedicated department column
    if (log.department) {
      return log.department
    }

    // Check department_info from enrichment
    if (log.department_info?.name) {
      return log.department_info.name
    }

    // Check payment_info department
    if (log.payment_info?.department_name) {
      return log.payment_info.department_name
    }

    // Check document_info department
    if (log.document_info?.department_name) {
      return log.document_info.department_name
    }

    // Check new_values for department
    const newDept = log.new_values?.department
    if (newDept && typeof newDept === "string" && newDept.length < 50) {
      return newDept
    }

    // Check old_values for department
    const oldDept = log.old_values?.department
    if (oldDept && typeof oldDept === "string" && oldDept.length < 50) {
      return oldDept
    }

    // Check for office_location
    const officeLocation = log.new_values?.office_location || log.old_values?.office_location
    if (officeLocation && typeof officeLocation === "string") {
      return officeLocation
    }

    return "-"
  }

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log)
    setIsDetailsOpen(true)
  }

  const formatValues = (values: any) => {
    if (!values) return null

    try {
      return (
        <div className="bg-muted/50 mt-2 rounded-lg p-3">
          <pre className="text-muted-foreground overflow-x-auto text-xs">{JSON.stringify(values, null, 2)}</pre>
        </div>
      )
    } catch {
      return null
    }
  }

  // Export functions
  const exportToExcel = async () => {
    try {
      if (filteredLogs.length === 0) {
        toast.error("No audit logs to export")
        return
      }

      const XLSX = await import("xlsx")
      const { default: saveAs } = await import("file-saver")

      const dataToExport = filteredLogs.map((log, index) => ({
        "#": index + 1,
        Action: (log.action || "unknown").toUpperCase(),
        Module: getNormalizedEntityType(log.entity_type),
        Object: getObjectIdentifier(log),
        Target: getTargetDescription(log),
        "Dept/Location": getDepartmentLocation(log),
        By: getPerformedBy(log),
        Date: formatDate(log.created_at),
      }))

      const ws = XLSX.utils.json_to_sheet(dataToExport)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Audit Logs")

      const maxWidth = 50
      const cols = Object.keys(dataToExport[0] || {}).map((key) => ({
        wch: Math.min(
          Math.max(key.length, ...dataToExport.map((row) => String(row[key as keyof typeof row]).length)),
          maxWidth
        ),
      }))
      ws["!cols"] = cols

      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      const data = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      saveAs(data, `audit-logs-export-${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Audit logs exported to Excel successfully")
    } catch (error: any) {
      console.error("Error exporting to Excel:", error)
      toast.error("Failed to export to Excel")
    }
  }

  const exportToPDF = async () => {
    try {
      if (filteredLogs.length === 0) {
        toast.error("No audit logs to export")
        return
      }

      const jsPDF = (await import("jspdf")).default
      const autoTable = (await import("jspdf-autotable")).default

      const doc = new jsPDF({ orientation: "landscape" })
      doc.setFontSize(16)
      doc.text("Audit Logs Report", 14, 15)
      doc.setFontSize(10)
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22)
      doc.text(`Total Logs: ${filteredLogs.length}`, 14, 28)

      const dataToExport = filteredLogs.map((log, index) => [
        index + 1,
        (log.action || "unknown").toUpperCase(),
        getNormalizedEntityType(log.entity_type),
        getObjectIdentifier(log),
        getTargetDescription(log),
        getDepartmentLocation(log),
        getPerformedBy(log),
        formatDate(log.created_at),
      ])

      autoTable(doc, {
        head: [["#", "Action", "Module", "Object", "Target", "Dept/Location", "By", "Date"]],
        body: dataToExport,
        startY: 35,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      })

      doc.save(`audit-logs-export-${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("Audit logs exported to PDF successfully")
    } catch (error: any) {
      console.error("Error exporting to PDF:", error)
      toast.error("Failed to export to PDF")
    }
  }

  const exportToWord = async () => {
    try {
      if (filteredLogs.length === 0) {
        toast.error("No audit logs to export")
        return
      }

      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        Table,
        TableCell,
        TableRow,
        WidthType,
        AlignmentType,
        HeadingLevel,
      } = await import("docx")
      const { default: saveAs } = await import("file-saver")

      const tableRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Action", bold: true })] })] }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Module", bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Object", bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Target", bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Dept/Location", bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "By", bold: true })] })],
            }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Date", bold: true })] })] }),
          ],
        }),
        ...filteredLogs.map(
          (log, index) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph((index + 1).toString())] }),
                new TableCell({ children: [new Paragraph((log.action || "unknown").toUpperCase())] }),
                new TableCell({ children: [new Paragraph(getNormalizedEntityType(log.entity_type))] }),
                new TableCell({ children: [new Paragraph(getObjectIdentifier(log))] }),
                new TableCell({ children: [new Paragraph(getTargetDescription(log))] }),
                new TableCell({ children: [new Paragraph(getDepartmentLocation(log))] }),
                new TableCell({ children: [new Paragraph(getPerformedBy(log))] }),
                new TableCell({ children: [new Paragraph(formatDate(log.created_at))] }),
              ],
            })
        ),
      ]

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: "Audit Logs Report",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Generated on: ${new Date().toLocaleDateString()}`,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Total Logs: ${filteredLogs.length}`,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({ text: "" }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: tableRows,
              }),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `audit-logs-export-${new Date().toISOString().split("T")[0]}.docx`)
      toast.success("Audit logs exported to Word successfully")
    } catch (error: any) {
      console.error("Error exporting to Word:", error)
      toast.error("Failed to export to Word")
    }
  }

  const stats = {
    total: logs.length,
    creates: logs.filter((l) => l.action === "create").length,
    updates: logs.filter((l) => l.action === "update").length,
    deletes: logs.filter((l) => l.action === "delete").length,
  }

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
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total Actions</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.total}</p>
                </div>
                <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                  <ScrollText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Creates</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.creates}</p>
                </div>
                <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/30">
                  <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Updates</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.updates}</p>
                </div>
                <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Deletes</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.deletes}</p>
                </div>
                <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                  <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      }
      filters={
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="assign">Assign</SelectItem>
                </SelectContent>
              </Select>

              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="device">Devices</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                  <SelectItem value="job_description">Job Descriptions</SelectItem>
                  <SelectItem value="user_documentation">Documentation</SelectItem>
                  <SelectItem value="profile">Profiles</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                  <SelectItem value="department_payments">Payments</SelectItem>
                  <SelectItem value="payment_documents">Documents</SelectItem>
                  <SelectItem value="departments">Departments</SelectItem>
                  <SelectItem value="payment_categories">Payment Categories</SelectItem>
                  <SelectItem value="leave_requests">Leave Requests</SelectItem>
                  <SelectItem value="leave_approvals">Leave Approvals</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={dateFilter}
                onValueChange={(value) => {
                  setDateFilter(value)
                  if (value !== "custom") {
                    setCustomStartDate("")
                    setCustomEndDate("")
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Time Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {/* Department filter - hidden for leads */}
              {userProfile?.role !== "lead" && (
                <SearchableSelect
                  value={departmentFilter}
                  onValueChange={setDepartmentFilter}
                  placeholder="All Departments"
                  searchPlaceholder="Search departments..."
                  icon={<Building2 className="h-4 w-4" />}
                  options={[
                    { value: "all", label: "All Departments" },
                    ...departments.map((dept) => ({
                      value: dept,
                      label: dept,
                      icon: <Building2 className="h-3 w-3" />,
                    })),
                  ]}
                />
              )}
              <SearchableSelect
                value={employeeFilter}
                onValueChange={setemployeeFilter}
                placeholder={
                  userProfile?.role === "lead" && scopedDepartments.length > 0
                    ? `All ${scopedDepartments.length === 1 ? scopedDepartments[0] : "Department"} employee`
                    : "All employee"
                }
                searchPlaceholder="Search employee..."
                icon={<User className="h-4 w-4" />}
                options={[
                  {
                    value: "all",
                    label:
                      userProfile?.role === "lead" && scopedDepartments.length > 0
                        ? `All ${scopedDepartments.length === 1 ? scopedDepartments[0] : "Department"} employee`
                        : "All employee",
                  },
                  ...employee.map((member) => ({
                    value: member.id,
                    label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                    icon: <User className="h-3 w-3" />,
                  })),
                ]}
              />
            </div>

            {dateFilter === "custom" && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-foreground text-sm font-medium">Start Date</label>
                  <div className="relative">
                    <Calendar className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="pl-10"
                      placeholder="Select start date"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-foreground text-sm font-medium">End Date</label>
                  <div className="relative">
                    <Calendar className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="pl-10"
                      placeholder="Select end date"
                      min={customStartDate}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      }
      filtersInCard={false}
    >
      {/* Export Filtered Data */}
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
                onClick={exportToExcel}
                className="gap-2"
                disabled={filteredLogs.length === 0}
              >
                <FileText className="h-4 w-4" />
                Excel (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToPDF}
                className="gap-2"
                disabled={filteredLogs.length === 0}
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToWord}
                className="gap-2"
                disabled={filteredLogs.length === 0}
              >
                <FileText className="h-4 w-4" />
                Word (.docx)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs List */}
      {filteredLogs.length > 0 ? (
        viewMode === "list" ? (
          <Card className="border-2">
            <div className="table-responsive">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Object</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Dept/Location</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log, index) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <Badge className={getActionColor(log.action)}>{(log.action || "unknown").toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground text-sm font-medium">
                          {getNormalizedEntityType(log.entity_type)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground font-mono text-sm">{getObjectIdentifier(log)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground text-sm">{getTargetDescription(log)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">{getDepartmentLocation(log)}</span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-sm ${log.entity_type === "feedback" && log.new_values?.is_anonymous ? "text-muted-foreground italic" : "text-foreground"}`}
                        >
                          {getPerformedBy(log)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">{formatDate(log.created_at)}</span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="border-2 transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge className={getActionColor(log.action)}>{(log.action || "unknown").toUpperCase()}</Badge>
                        <span className="text-foreground text-sm font-medium">
                          {getNormalizedEntityType(log.entity_type)}
                        </span>
                        <span className="text-primary font-mono text-sm">{getObjectIdentifier(log)}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-foreground text-sm">{getTargetDescription(log)}</span>
                        {getDepartmentLocation(log) !== "-" && (
                          <>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-muted-foreground text-sm">{getDepartmentLocation(log)}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="text-muted-foreground h-4 w-4" />
                          <span className="text-muted-foreground">By:</span>
                          <span
                            className={`${log.entity_type === "feedback" && log.new_values?.is_anonymous ? "text-muted-foreground italic" : "text-foreground"}`}
                          >
                            {getPerformedBy(log)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="text-muted-foreground h-4 w-4" />
                          <span className="text-muted-foreground">{formatDate(log.created_at)}</span>
                        </div>
                      </div>

                      {log.old_values && (
                        <details className="mt-2">
                          <summary className="text-foreground hover:text-primary cursor-pointer text-sm font-medium">
                            Old Values
                          </summary>
                          {formatValues(log.old_values)}
                        </details>
                      )}

                      {log.new_values && (
                        <details className="mt-2">
                          <summary className="text-foreground hover:text-primary cursor-pointer text-sm font-medium">
                            New Values
                          </summary>
                          {formatValues(log.new_values)}
                        </details>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(log)} className="gap-2">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card className="border-2">
          <CardContent className="p-12 text-center">
            <ScrollText className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
            <h3 className="text-foreground mb-2 text-xl font-semibold">No Audit Logs Found</h3>
            <p className="text-muted-foreground">
              {searchQuery ||
              actionFilter !== "all" ||
              entityFilter !== "all" ||
              dateFilter !== "all" ||
              departmentFilter !== "all" ||
              employeeFilter !== "all"
                ? "No logs match your filters"
                : "No audit logs available yet"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination info */}
      {filteredLogs.length > 0 && (
        <div className="text-muted-foreground text-center text-sm">
          Showing {filteredLogs.length} of {logs.length} total logs
          {logs.length >= 500 && " (limited to last 500 entries)"}
        </div>
      )}
      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Audit Log Details</DialogTitle>
            <DialogDescription>Complete information about this audit event</DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              {/* Action and Entity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Action</Label>
                  <div>
                    <Badge className={getActionColor(selectedLog.action)}>{selectedLog.action.toUpperCase()}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Entity Type</Label>
                  <div className="text-sm font-medium">{getNormalizedEntityType(selectedLog.entity_type)}</div>
                </div>
              </div>

              {/* Target/Affected */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Target/Affected</Label>
                <div className="bg-muted/50 rounded-lg border p-3">
                  <p className="text-sm font-medium">{getTargetDescription(selectedLog)}</p>
                  {selectedLog.target_user && (
                    <p className="text-muted-foreground mt-1 text-xs">{selectedLog.target_user.company_email}</p>
                  )}
                  {selectedLog.task_info && (
                    <div className="mt-2 border-t pt-2">
                      <p className="text-muted-foreground text-xs">Task: {selectedLog.task_info.title}</p>
                      {selectedLog.task_info.assigned_to_user && (
                        <p className="text-muted-foreground text-xs">
                          Assigned to: {formatName(selectedLog.task_info.assigned_to_user.first_name)}{" "}
                          {formatName(selectedLog.task_info.assigned_to_user.last_name)}
                        </p>
                      )}
                    </div>
                  )}
                  {selectedLog.device_info && (
                    <div className="mt-2 border-t pt-2">
                      <p className="text-muted-foreground text-xs">Device: {selectedLog.device_info.device_name}</p>
                      {selectedLog.device_info.assigned_to_user && (
                        <p className="text-muted-foreground text-xs">
                          Assigned to: {formatName(selectedLog.device_info.assigned_to_user.first_name)}{" "}
                          {formatName(selectedLog.device_info.assigned_to_user.last_name)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Performed By */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Performed By</Label>
                <div className="bg-muted/50 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <User className="text-muted-foreground h-4 w-4" />
                    <span
                      className={`text-sm font-medium ${selectedLog.entity_type === "feedback" && selectedLog.new_values?.is_anonymous ? "text-muted-foreground italic" : ""}`}
                    >
                      {getPerformedBy(selectedLog)}
                    </span>
                  </div>
                  {selectedLog.entity_type !== "feedback" || !selectedLog.new_values?.is_anonymous ? (
                    <p className="text-muted-foreground mt-1 text-xs">{(selectedLog.user as any)?.company_email}</p>
                  ) : null}
                </div>
              </div>

              {/* Date and Time */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Date & Time</Label>
                <div className="bg-muted/50 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-muted-foreground h-4 w-4" />
                    <span className="text-sm">{formatDate(selectedLog.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Old Values */}
              {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Old Values</Label>
                  <div className="bg-muted/50 max-h-60 overflow-auto rounded-lg border p-4">
                    <pre className="font-mono text-xs whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* New Values */}
              {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">New Values</Label>
                  <div className="bg-muted/50 max-h-60 overflow-auto rounded-lg border p-4">
                    <pre className="font-mono text-xs whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Entity ID */}
              {selectedLog.entity_id && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Entity ID</Label>
                  <div className="bg-muted/50 rounded-lg border p-3">
                    <code className="font-mono text-xs break-all">{selectedLog.entity_id}</code>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex gap-2 border-t pt-4">
                <Button onClick={() => setIsDetailsOpen(false)} variant="outline" className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminTablePage>
  )
}
