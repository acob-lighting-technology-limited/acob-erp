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

interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id?: string
  old_values?: any
  new_values?: any
  created_at: string
  user?: {
    first_name: string
    last_name: string
    company_email: string
  }
  target_user?: {
    first_name: string
    last_name: string
    company_email: string
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
  }
  document_info?: {
    file_name: string
    document_type: string
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

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [staff, setStaff] = useState<{ id: string; first_name: string; last_name: string; department: string }[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [userProfile, setUserProfile] = useState<{ role?: string; lead_departments?: string[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [staffFilter, setStaffFilter] = useState("all")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      // Get current user profile to check if they're a lead
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("role, lead_departments")
        .eq("id", user.id)
        .single()

      setUserProfile(userProfile || null)

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
        const userEntityIds = new Set(
          logsData
            .filter(
              (log) =>
                log.entity_id &&
                (log.entity_type === "profile" || log.entity_type === "user" || log.entity_type === "pending_user")
            )
            .map((log) => log.entity_id)
            .filter(Boolean)
        )

        const taskEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => log.entity_id && log.entity_type === "task")
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const deviceEntityIds = Array.from(
          new Set(
            logsData
              .filter(
                (log) => log.entity_id && (log.entity_type === "device" || log.entity_type === "device_assignment")
              )
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const assetEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => log.entity_id && (log.entity_type === "asset" || log.entity_type === "asset_assignment"))
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const paymentEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => log.entity_id && log.entity_type === "department_payments")
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const documentEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => log.entity_id && log.entity_type === "payment_documents")
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const departmentEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => log.entity_id && log.entity_type === "departments")
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const categoryEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => log.entity_id && log.entity_type === "payment_categories")
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        // Leave request entity IDs (for leave_requests and leave_approvals)
        const leaveRequestEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => log.entity_id && log.entity_type === "leave_requests")
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        const leaveApprovalEntityIds = Array.from(
          new Set(
            logsData
              .filter((log) => log.entity_id && log.entity_type === "leave_approvals")
              .map((log) => log.entity_id)
              .filter(Boolean)
          )
        )

        // Combine all user IDs for a single query
        const allUserIds = Array.from(new Set([...uniqueUserIds, ...(Array.from(userEntityIds) as string[])]))

        // Fetch all users
        const { data: usersData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, company_email")
          .in("id", allUserIds)

        const usersMap = new Map(usersData?.map((user) => [user.id, user]))

        // Fetch tasks if needed
        let tasksMap = new Map()
        if (taskEntityIds.length > 0) {
          const { data: tasksData } = await supabase
            .from("tasks")
            .select("id, title, assigned_to")
            .in("id", taskEntityIds)

          if (tasksData) {
            // Get assigned users for tasks
            const taskUserIds = Array.from(new Set(tasksData.map((t) => t.assigned_to).filter(Boolean)))
            if (taskUserIds.length > 0) {
              const { data: taskUsersData } = await supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .in("id", taskUserIds)

              const taskUsersMap = new Map(taskUsersData?.map((u) => [u.id, u]))

              tasksMap = new Map(
                tasksData.map((task) => [
                  task.id,
                  {
                    title: task.title,
                    assigned_to: task.assigned_to,
                    assigned_to_user: task.assigned_to ? taskUsersMap.get(task.assigned_to) : null,
                  },
                ])
              )
            } else {
              tasksMap = new Map(tasksData.map((task) => [task.id, { title: task.title }]))
            }
          }
        }

        // Fetch devices and their current assignments if needed
        let devicesMap = new Map()
        if (deviceEntityIds.length > 0) {
          const { data: devicesData } = await supabase
            .from("devices")
            .select("id, device_name")
            .in("id", deviceEntityIds)

          if (devicesData) {
            // Get current device assignments
            const { data: assignmentsData } = await supabase
              .from("device_assignments")
              .select("device_id, assigned_to")
              .in("device_id", deviceEntityIds)
              .eq("is_current", true)

            const assignmentsMap = new Map(assignmentsData?.map((a) => [a.device_id, a.assigned_to]))

            // Get assigned users
            const deviceUserIds = Array.from(new Set(Array.from(assignmentsMap.values()).filter(Boolean)))
            let deviceUsersMap = new Map()
            if (deviceUserIds.length > 0) {
              const { data: deviceUsersData } = await supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .in("id", deviceUserIds)

              deviceUsersMap = new Map(deviceUsersData?.map((u) => [u.id, u]))
            }

            devicesMap = new Map(
              devicesData.map((device) => {
                const assignedTo = assignmentsMap.get(device.id)
                return [
                  device.id,
                  {
                    device_name: device.device_name,
                    assigned_to: assignedTo,
                    assigned_to_user: assignedTo ? deviceUsersMap.get(assignedTo) : null,
                  },
                ]
              })
            )
          }
        }

        // Fetch assets and their current assignments if needed
        let assetsMap = new Map()
        if (assetEntityIds.length > 0) {
          const { data: assetsData } = await supabase.from("assets").select("id, asset_name").in("id", assetEntityIds)

          if (assetsData) {
            // Get current asset assignments
            const { data: assignmentsData } = await supabase
              .from("asset_assignments")
              .select("asset_id, assigned_to")
              .in("asset_id", assetEntityIds)
              .eq("is_current", true)

            const assignmentsMap = new Map(assignmentsData?.map((a) => [a.asset_id, a.assigned_to]))

            // Get assigned users
            const assetUserIds = Array.from(new Set(Array.from(assignmentsMap.values()).filter(Boolean)))
            let assetUsersMap = new Map()
            if (assetUserIds.length > 0) {
              const { data: assetUsersData } = await supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .in("id", assetUserIds)

              assetUsersMap = new Map(assetUsersData?.map((u) => [u.id, u]))
            }

            assetsMap = new Map(
              assetsData.map((asset) => {
                const assignedTo = assignmentsMap.get(asset.id)
                return [
                  asset.id,
                  {
                    asset_name: asset.asset_name,
                    assigned_to: assignedTo,
                    assigned_to_user: assignedTo ? assetUsersMap.get(assignedTo) : null,
                  },
                ]
              })
            )
          }
        }

        // Fetch payments if needed
        let paymentsMap = new Map()
        if (paymentEntityIds.length > 0) {
          const { data: paymentsData } = await supabase
            .from("department_payments")
            .select("id, title, amount, currency")
            .in("id", paymentEntityIds)

          if (paymentsData) {
            paymentsMap = new Map(paymentsData.map((p) => [p.id, p]))
          }
        }

        // Fetch documents if needed
        let documentsMap = new Map()
        if (documentEntityIds.length > 0) {
          const { data: documentsData } = await supabase
            .from("payment_documents")
            .select("id, file_name, document_type")
            .in("id", documentEntityIds)

          if (documentsData) {
            documentsMap = new Map(documentsData.map((d) => [d.id, d]))
          }
        }

        // Fetch departments if needed (for department entity logs)
        let departmentsMap = new Map()
        if (departmentEntityIds.length > 0) {
          const { data: departmentsData } = await supabase
            .from("departments")
            .select("id, name")
            .in("id", departmentEntityIds)

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
        const logsWithUsers = logsData.map((log) => {
          let targetFromNewValues = null

          // Check new_values for assigned_to if we don't have task/device/asset info yet
          if (log.entity_type === "task" && !tasksMap.get(log.entity_id) && log.new_values?.assigned_to) {
            targetFromNewValues = usersMap.get(log.new_values.assigned_to)
          }

          if (
            (log.entity_type === "device" || log.entity_type === "device_assignment") &&
            !devicesMap.get(log.entity_id) &&
            log.new_values?.assigned_to
          ) {
            targetFromNewValues = usersMap.get(log.new_values.assigned_to)
          }

          if (
            (log.entity_type === "asset" || log.entity_type === "asset_assignment") &&
            !assetsMap.get(log.entity_id) &&
            log.new_values?.assigned_to
          ) {
            targetFromNewValues = usersMap.get(log.new_values.assigned_to)
          }

          return {
            ...log,
            user: log.user_id ? usersMap.get(log.user_id) : null,
            target_user: log.entity_id ? usersMap.get(log.entity_id) : targetFromNewValues || null,
            task_info: log.entity_id && log.entity_type === "task" ? tasksMap.get(log.entity_id) : null,
            device_info:
              log.entity_id && (log.entity_type === "device" || log.entity_type === "device_assignment")
                ? devicesMap.get(log.entity_id)
                : null,
            asset_info:
              log.entity_id && (log.entity_type === "asset" || log.entity_type === "asset_assignment")
                ? assetsMap.get(log.entity_id)
                : null,
            payment_info:
              log.entity_id && log.entity_type === "department_payments" ? paymentsMap.get(log.entity_id) : null,
            document_info:
              log.entity_id && log.entity_type === "payment_documents" ? documentsMap.get(log.entity_id) : null,
            department_info:
              log.entity_id && log.entity_type === "departments" ? departmentsMap.get(log.entity_id) : null,
            category_info:
              log.entity_id && log.entity_type === "payment_categories" ? categoriesMap.get(log.entity_id) : null,
            leave_request_info:
              log.entity_id && (log.entity_type === "leave_requests" || log.entity_type === "leave_approvals")
                ? leaveRequestsMap.get(log.entity_id)
                : null,
          }
        })

        console.log("Loaded audit logs count:", logsWithUsers.length)
        setLogs(logsWithUsers as any)
      } else {
        console.log("No audit logs found")
        setLogs([])
      }

      // Load staff for filter - leads can only see staff in their departments
      let staffQuery = supabase
        .from("profiles")
        .select("id, first_name, last_name, department")
        .order("last_name", { ascending: true })

      // If user is a lead, filter by their lead departments
      if (userProfile?.role === "lead" && userProfile.lead_departments && userProfile.lead_departments.length > 0) {
        staffQuery = staffQuery.in("department", userProfile.lead_departments)
      }

      const { data: staffData } = await staffQuery
      setStaff(staffData || [])

      // Extract unique departments - for leads, only show their lead departments
      let uniqueDepartments: string[] = []
      if (userProfile?.role === "lead" && userProfile.lead_departments && userProfile.lead_departments.length > 0) {
        uniqueDepartments = userProfile.lead_departments.sort()
      } else {
        uniqueDepartments = Array.from(new Set(staffData?.map((s: any) => s.department).filter(Boolean))) as string[]
        uniqueDepartments.sort()
      }
      setDepartments(uniqueDepartments)
    } catch (error: any) {
      console.error("Error loading audit logs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.user as any)?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.user as any)?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesAction = actionFilter === "all" || log.action === actionFilter
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter

    // Filter by department - for leads, always filter by their departments
    let matchesDepartment = true
    if (userProfile?.role === "lead") {
      // Leads: logs are already filtered, but ensure they match lead's departments
      if (userProfile.lead_departments && userProfile.lead_departments.length > 0) {
        const userDept = staff.find((s) => s.id === log.user_id)?.department
        matchesDepartment = userDept ? userProfile.lead_departments.includes(userDept) : false
      }
    } else {
      // Admins: use department filter
      matchesDepartment =
        departmentFilter === "all" ||
        (log.user ? staff.find((s) => s.id === log.user_id)?.department === departmentFilter : false)
    }

    // Filter by staff
    const matchesStaff = staffFilter === "all" || log.user_id === staffFilter

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

    return matchesSearch && matchesAction && matchesEntity && matchesDate && matchesDepartment && matchesStaff
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

  const getTargetDescription = (log: AuditLog) => {
    const action = log.action.toLowerCase()
    const entityType = log.entity_type.toLowerCase()

    // First priority: Check if we have target_user (this handles all user-related targets including tasks)
    if (
      log.target_user &&
      (entityType === "profile" ||
        entityType === "user" ||
        entityType === "pending_user" ||
        entityType === "task" ||
        entityType === "device" ||
        entityType === "device_assignment" ||
        entityType === "asset" ||
        entityType === "asset_assignment" ||
        entityType === "job_description")
    ) {
      const name = `${formatName(log.target_user.first_name)} ${formatName(log.target_user.last_name)}`
      return name
    }

    // Handle task-related logs with task_info
    if (entityType === "task" && log.task_info) {
      if (log.task_info.assigned_to_user) {
        const name = `${formatName(log.task_info.assigned_to_user.first_name)} ${formatName(log.task_info.assigned_to_user.last_name)}`
        return name
      }
    }

    // Handle device-related logs with device_info
    if ((entityType === "device" || entityType === "device_assignment") && log.device_info) {
      if (log.device_info.assigned_to_user) {
        const name = `${formatName(log.device_info.assigned_to_user.first_name)} ${formatName(log.device_info.assigned_to_user.last_name)}`
        return name
      }
      // Devices can be unassigned
      return "-"
    }

    // Handle asset-related logs - show WHO it's assigned to (the target person)
    if (entityType === "asset" || entityType === "asset_assignment") {
      // For assignment actions, show the assigned person
      if (action === "assign" || action === "reassign") {
        // Check new_values for assigned user
        if (log.new_values?.assigned_to && log.target_user) {
          return `${formatName(log.target_user.first_name)} ${formatName(log.target_user.last_name)}`
        }
        // Check for department assignment
        if (log.new_values?.department) {
          return `${log.new_values.department} (Department)`
        }
        // Check for office assignment
        if (log.new_values?.office_location) {
          return `${log.new_values.office_location} (Office)`
        }
      }

      // For non-assignment actions (create, update, delete), show the asset code
      const uniqueCode = log.new_values?.unique_code || log.old_values?.unique_code
      if (uniqueCode) {
        return uniqueCode
      }

      return "Asset"
    }

    // Handle user-related logs
    if (entityType === "profile" || entityType === "user" || entityType === "pending_user") {
      // Check new_values for user creation
      if (log.new_values?.first_name && log.new_values?.last_name) {
        return `${formatName(log.new_values.first_name)} ${formatName(log.new_values.last_name)}`
      }
      return "User"
    }

    // Handle documentation - target is the person who created it (the user performing the action)
    if (entityType === "user_documentation" || entityType === "documentation") {
      if (log.user) {
        const name = `${formatName(log.user.first_name)} ${formatName(log.user.last_name)}`
        return name
      }
      return "Documentation"
    }

    // Handle feedback - show the feedback title and type
    if (entityType === "feedback") {
      const title = log.new_values?.title || log.old_values?.title
      const feedbackType = log.new_values?.feedback_type || log.old_values?.feedback_type
      if (title) {
        return feedbackType ? `${title} (${feedbackType})` : title
      }
      return "Feedback"
    }

    // Handle Payments
    if (entityType === "department_payments") {
      if (log.payment_info) {
        return `${log.payment_info.title} (${log.payment_info.currency} ${log.payment_info.amount})`
      }
      // Fallback to title in values
      const title = log.new_values?.title || log.old_values?.title
      if (title) return title
      return "Payment"
    }

    // Handle Payment Documents
    if (entityType === "payment_documents") {
      if (log.document_info) {
        return `${log.document_info.file_name} (${log.document_info.document_type})`
      }
      const fileName = log.new_values?.file_name || log.old_values?.file_name
      if (fileName) return fileName
      return "Payment Document"
    }

    // Handle Departments
    if (entityType === "departments") {
      if (log.department_info) return log.department_info.name
      const name = log.new_values?.name || log.old_values?.name
      if (name) return name
      return "Department"
    }

    // Handle Payment Categories
    if (entityType === "payment_categories") {
      if (log.category_info) return log.category_info.name
      const name = log.new_values?.name || log.old_values?.name
      if (name) return name
      return "Payment Category"
    }

    // Handle Leave Requests - show requester's name
    if (entityType === "leave_requests") {
      if (log.leave_request_info?.requester_user) {
        const name = `${formatName(log.leave_request_info.requester_user.first_name)} ${formatName(log.leave_request_info.requester_user.last_name)}`
        return `${name} (${log.leave_request_info.leave_type_name})`
      }
      // Fallback to new_values user_id lookup
      if (log.new_values?.user_id && log.target_user) {
        return `${formatName(log.target_user.first_name)} ${formatName(log.target_user.last_name)}`
      }
      return "Leave Request"
    }

    // Handle Leave Approvals - show the person whose leave was approved
    if (entityType === "leave_approvals") {
      if (log.leave_request_info?.requester_user) {
        const name = `${formatName(log.leave_request_info.requester_user.first_name)} ${formatName(log.leave_request_info.requester_user.last_name)}`
        return `${name} (${log.leave_request_info.leave_type_name})`
      }
      return "Leave Approval"
    }

    // Fallback for devices/assets without assignment
    if (
      entityType === "device" ||
      entityType === "device_assignment" ||
      entityType === "asset" ||
      entityType === "asset_assignment"
    ) {
      return "-"
    }

    // For any other entity types, capitalize and show nicely
    if (log.entity_id) {
      return entityType
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    }

    return "N/A"
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
        Action: log.action,
        "Entity Type": log.entity_type,
        "Target/Affected": getTargetDescription(log),
        "Performed By": getPerformedBy(log),
        Date: formatDate(log.created_at),
        Email: log.user?.company_email || "N/A",
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
        log.action,
        log.entity_type,
        getTargetDescription(log),
        getPerformedBy(log),
        formatDate(log.created_at),
      ])

      autoTable(doc, {
        head: [["#", "Action", "Entity Type", "Target/Affected", "Performed By", "Date"]],
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
              children: [new Paragraph({ children: [new TextRun({ text: "Entity Type", bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Target/Affected", bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Performed By", bold: true })] })],
            }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Date", bold: true })] })] }),
          ],
        }),
        ...filteredLogs.map(
          (log, index) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph((index + 1).toString())] }),
                new TableCell({ children: [new Paragraph(log.action)] }),
                new TableCell({ children: [new Paragraph(log.entity_type)] }),
                new TableCell({ children: [new Paragraph(getTargetDescription(log))] }),
                new TableCell({
                  children: [new Paragraph(getPerformedBy(log))],
                }),
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
    <div className="from-background via-background to-muted/20 min-h-screen w-full overflow-x-hidden bg-gradient-to-br">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
              <ScrollText className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
              Audit Logs
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Complete audit trail of all system activities
            </p>
          </div>
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
        </div>

        {/* Stats */}
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

        {/* Filters */}
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
                value={staffFilter}
                onValueChange={setStaffFilter}
                placeholder={
                  userProfile?.role === "lead" &&
                  userProfile.lead_departments &&
                  userProfile.lead_departments.length > 0
                    ? `All ${userProfile.lead_departments.length === 1 ? userProfile.lead_departments[0] : "Department"} Staff`
                    : "All Staff"
                }
                searchPlaceholder="Search staff..."
                icon={<User className="h-4 w-4" />}
                options={[
                  {
                    value: "all",
                    label:
                      userProfile?.role === "lead" &&
                      userProfile.lead_departments &&
                      userProfile.lead_departments.length > 0
                        ? `All ${userProfile.lead_departments.length === 1 ? userProfile.lead_departments[0] : "Department"} Staff`
                        : "All Staff",
                  },
                  ...staff.map((member) => ({
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
                      <TableHead>Entity</TableHead>
                      <TableHead>Target/Affected</TableHead>
                      <TableHead>Performed By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log, index) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <Badge className={getActionColor(log.action)}>{log.action.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-foreground text-sm font-medium">
                            {log.entity_type.replace("_", " ").toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-foreground text-sm">{getTargetDescription(log)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <User className="text-muted-foreground h-3 w-3" />
                            <span
                              className={`${log.entity_type === "feedback" && log.new_values?.is_anonymous ? "text-muted-foreground italic" : "text-foreground"}`}
                            >
                              {getPerformedBy(log)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="text-muted-foreground h-3 w-3" />
                            <span className="text-muted-foreground">{formatDate(log.created_at)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetails(log)} className="gap-2">
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
                          <Badge className={getActionColor(log.action)}>{log.action.toUpperCase()}</Badge>
                          <span className="text-foreground text-sm font-medium">
                            {log.entity_type.replace("_", " ").toUpperCase()}
                          </span>
                          <span className="text-muted-foreground text-sm">{getTargetDescription(log)}</span>
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
                staffFilter !== "all"
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
      </div>

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
                  <div className="text-sm font-medium">{selectedLog.entity_type.replace("_", " ").toUpperCase()}</div>
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
    </div>
  )
}
