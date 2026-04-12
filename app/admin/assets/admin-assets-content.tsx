"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import { isAssignableProfile } from "@/lib/workforce/assignment-policy"
import { ASSET_TYPES, ASSET_TYPE_MAP } from "@/lib/asset-types"
import { getDepartmentForOffice } from "@/lib/office-locations"
import { assignmentValidation } from "@/lib/validation"
import { Package, AlertCircle, Loader2, Plus, Download } from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"

import { logger } from "@/lib/logger"

import { AssetFormDialog } from "@/components/assets/AssetFormDialog"
import { AssetAssignDialog } from "@/components/assets/AssetAssignDialog"
import { AssetHistoryDialog } from "@/components/assets/AssetHistoryDialog"
import { AssetIssuesDialog } from "@/components/assets/AssetIssuesDialog"
import { AssetTypeDialog } from "@/components/assets/AssetTypeDialog"
import { AssetExportDialog } from "@/components/assets/AssetExportDialog"
import { EmployeeAssetsReportDialog } from "@/components/assets/EmployeeAssetsReportDialog"
import { AssetFilterBar } from "@/components/assets/AssetFilterBar"
import { TableViewToggle } from "@/components/admin/table-view-toggle"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"
import {
  buildAssetExportRows,
  exportAssetsToExcel,
  exportAssetsToPDF,
  exportAssetsToWord,
  exportEmployeeReportToExcel,
  exportEmployeeReportToPDF,
  exportEmployeeReportToWord,
} from "@/lib/assets/asset-export"
import { AssetListView } from "@/components/assets/AssetListView"

const log = logger("assets-admin-assets-content")

async function fetchAssetTypes(): Promise<{ label: string; code: string; requiresSerialModel: boolean }[]> {
  const response = await fetch("/api/admin/assets/types", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    log.warn("Could not load asset types from API:", payload?.error || response.status)
    return ASSET_TYPES
  }

  const payload = (await response.json()) as {
    data?: { label: string; code: string; requires_serial_model?: boolean | null }[]
  }
  const data = payload?.data || []
  if (data.length > 0) {
    return data.map((t) => ({
      label: t.label,
      code: t.code,
      requiresSerialModel: t.requires_serial_model || false,
    }))
  }
  return ASSET_TYPES
}

export interface Asset {
  id: string
  unique_code: string
  asset_type: string
  acquisition_year: number
  asset_model?: string
  serial_number?: string
  status: string
  notes?: string
  created_at: string
  created_by: string
  assignment_type?: "individual" | "department" | "office"
  department?: string
  office_location?: string
  current_assignment?: {
    assigned_to?: string
    department?: string
    office_location?: string
    assignment_type?: "individual" | "department" | "office" | string
    user?: {
      first_name: string
      last_name: string
    }
  }
  issues?: AssetIssue[]
  unresolved_issues_count?: number
  deleted_at?: string | null
  deleted_by?: string | null
  delete_reason?: string | null
}

interface AssetIssue {
  id: string
  asset_id: string
  description: string
  resolved: boolean
  created_at: string
  resolved_at?: string
  resolved_by?: string
  created_by: string
}

export interface Employee {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
  employment_status?: string | null
}

interface AssetAssignment {
  id: string
  assigned_to?: string
  department?: string
  office_location?: string
  assignment_type?: string
  assigned_at: string
  is_current: boolean
  user?: {
    first_name: string
    last_name: string
  }
}

type AssignableAsset = {
  status: string
  assignment_type?: string
  department?: string
  office_location?: string
  current_assignment?: {
    assigned_to?: string
    department?: string
    office_location?: string
    assignment_type?: string
    user?: {
      first_name: string
      last_name: string
    }
  }
}

type ProfileNameRow = {
  id: string
  first_name?: string | null
  last_name?: string | null
}

type SortableValue = string | number

interface AssetActivity {
  id: string
  timestamp: string
  type: "assignment" | "unassignment" | "status_change" | "issue_reported" | "issue_resolved"
  title: string
  description?: string
  user_name?: string
  performed_by_name?: string
  details?: {
    assigned_to?: string
    department?: string
    office_location?: string
    assignment_type?: string
    notes?: string
    status?: string
    old_status?: string
  }
}

const currentYear = new Date().getFullYear()

export interface UserProfile {
  role: string
  admin_domains?: string[] | null
  is_department_lead?: boolean
  lead_departments?: string[]
  managed_departments?: string[]
  managed_offices?: string[]
}

interface AdminAssetsContentProps {
  initialAssets: Asset[]
  initialEmployees: Employee[]
  initialDepartments: string[]
  userProfile: UserProfile
  initialError?: string | null
}

export function AdminAssetsContent({
  initialAssets,
  initialEmployees,
  initialDepartments,
  userProfile,
  initialError,
}: AdminAssetsContentProps) {
  const router = useRouter()
  const normalizedRole = String(userProfile?.role || "")
    .trim()
    .toLowerCase()
  const adminDomains = Array.isArray(userProfile?.admin_domains)
    ? userProfile.admin_domains.map((domain) => String(domain).trim().toLowerCase())
    : []
  const canCreateAssetType =
    normalizedRole === "developer" ||
    normalizedRole === "super_admin" ||
    (normalizedRole === "admin" && adminDomains.includes("assets"))
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const activeEmployees = employees.filter((member) => isAssignableProfile(member, { allowLegacyNullStatus: false }))
  const [departments] = useState<string[]>(initialDepartments)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([])
  const [userFilter, setUserFilter] = useState<string[]>([])
  const [yearFilter, setYearFilter] = useState<string[]>([])
  const [officeLocationFilter, setOfficeLocationFilter] = useState<string[]>([])
  const [assetTypeFilter, setAssetTypeFilter] = useState<string[]>([])
  const [issueStatusFilter, setIssueStatusFilter] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportType, setExportType] = useState<"excel" | "pdf" | "word" | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({
    "#": true,
    "Unique Code": true,
    "Asset Type": true,
    Model: true,
    "Serial Number": true,
    Year: true,
    Status: true,
    "Assigned To": true,
    Department: true,
    "Office Location": true,
    Issues: true,
  })

  // Employee Assets Report dialog state
  const [employeeReportDialogOpen, setEmployeeReportDialogOpen] = useState(false)
  const [employeeReportExportType, setEmployeeReportExportType] = useState<"excel" | "pdf" | "word" | null>(null)
  const [employeeReportSelectedTypes, setEmployeeReportSelectedTypes] = useState<Record<string, boolean>>({})
  const [exportOptionsOpen, setExportOptionsOpen] = useState(false)

  // Dialog states
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isIssuesDialogOpen, setIsIssuesDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [assetHistory, setAssetHistory] = useState<AssetActivity[]>([])

  // Issue tracking states
  const [assetIssues, setAssetIssues] = useState<AssetIssue[]>([])
  const [newIssueDescription, setNewIssueDescription] = useState("")
  const [isAddingIssue, setIsAddingIssue] = useState(false)

  // Asset type creation states
  const [isCreateAssetTypeDialogOpen, setIsCreateAssetTypeDialogOpen] = useState(false)
  const [newAssetType, setNewAssetType] = useState({ label: "", code: "", requiresSerialModel: false })
  const [isCreatingAssetType, setIsCreatingAssetType] = useState(false)
  const [assetTypes, setAssetTypes] =
    useState<{ label: string; code: string; requiresSerialModel: boolean }[]>(ASSET_TYPES)
  const [batchQuantity, setBatchQuantity] = useState(1)

  interface AssetFormState {
    asset_type: string
    acquisition_year: number
    asset_model: string
    serial_number: string
    unique_code: string
    status: string
    notes: string
    assignment_type: "individual" | "department" | "office"
    assigned_to: string
    assignment_department: string
    office_location: string
    assignment_notes: string
    assigned_by: string
    assigned_at: string
  }

  // Track original form values for change detection
  const [originalAssetForm, setOriginalAssetForm] = useState<AssetFormState>({
    asset_type: "",
    acquisition_year: currentYear,
    asset_model: "",
    serial_number: "",
    unique_code: "",
    status: "available",
    notes: "",
    assignment_type: "individual",
    assigned_to: "",
    assignment_department: "",
    office_location: "",
    assignment_notes: "",
    assigned_by: "",
    assigned_at: "",
  })

  // Form states
  const [assetForm, setAssetForm] = useState<AssetFormState>({
    asset_type: "",
    acquisition_year: currentYear,
    asset_model: "",
    serial_number: "",
    unique_code: "",
    status: "available",
    notes: "",
    assignment_type: "individual",
    assigned_to: "",
    assignment_department: "",
    office_location: "",
    assignment_notes: "",
    assigned_by: "",
    assigned_at: "",
  })

  interface AssignFormState {
    assignment_type: "individual" | "department" | "office"
    assigned_to: string
    department: string
    office_location: string
    assignment_notes: string
    assigned_by: string
    assigned_at: string
  }

  const [assignForm, setAssignForm] = useState<AssignFormState>({
    assignment_type: "individual",
    assigned_to: "",
    department: "",
    office_location: "",
    assignment_notes: "",
    assigned_by: "",
    assigned_at: "",
  })

  const [currentAssignment] = useState<AssetAssignment | null>(null)

  const supabase = createClient()
  const scopedDepartments = userProfile.managed_departments ?? userProfile.lead_departments ?? []
  const scopedOffices = userProfile.managed_offices ?? []

  const queryClient = useQueryClient()

  const { data: fetchedAssetTypes } = useQuery({
    queryKey: QUERY_KEYS.adminAssetTypes(),
    queryFn: fetchAssetTypes,
    initialData: ASSET_TYPES,
  })

  // Keep assetTypes in sync with query result
  useEffect(() => {
    if (fetchedAssetTypes) {
      setAssetTypes(fetchedAssetTypes)
    }
  }, [fetchedAssetTypes])

  useEffect(() => {
    if (initialError) {
      toast.error(initialError)
    }
  }, [initialError])

  const handleCreateAssetType = async () => {
    if (!canCreateAssetType) {
      toast.error("You do not have permission to create asset types")
      return
    }

    if (!newAssetType.label.trim() || !newAssetType.code.trim()) {
      toast.error("Please provide both full name and short name")
      return
    }

    // Validate code format (should be uppercase, no spaces)
    const code = newAssetType.code.trim().toUpperCase().replace(/\s+/g, "")
    if (!code) {
      toast.error("Short name must contain at least one character")
      return
    }

    setIsCreatingAssetType(true)
    try {
      const response = await fetch("/api/admin/assets/types", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label: newAssetType.label.trim(),
          code,
          requiresSerialModel: newAssetType.requiresSerialModel,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string; code?: string } | null
        if (response.status === 409 || payload?.code === "23505") {
          toast.error("An asset type with this name or code already exists")
        } else if (response.status === 403) {
          toast.error("You do not have permission to create asset types")
        } else if (response.status === 401) {
          toast.error("You must be logged in to create asset types")
        } else {
          throw new Error(payload?.error || "Failed to create asset type")
        }
        return
      }

      toast.success("Asset type created successfully")
      setNewAssetType({ label: "", code: "", requiresSerialModel: false })
      setIsCreateAssetTypeDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminAssetTypes() })
      // Auto-select the newly created asset type
      setAssetForm({ ...assetForm, asset_type: code })
    } catch (error: unknown) {
      log.error("Error creating asset type:", error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error("Failed to create asset type: " + message)
    } finally {
      setIsCreatingAssetType(false)
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/assets/snapshot", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`Failed to refresh assets (${response.status})`)
      }

      const payload = (await response.json()) as { assets: Asset[]; employees: Employee[] }
      setAssets(payload.assets || [])
      setEmployees(payload.employees || [])
    } catch (error: unknown) {
      log.error("Error loading data:", error)
      toast.error("Failed to refresh data")
    } finally {
      setIsLoading(false)
    }
  }

  const loadAssetHistory = async (asset: Asset) => {
    try {
      // 1. Fetch Assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from("asset_assignments")
        .select(
          "id, assigned_at, handed_over_at, assignment_notes, handover_notes, assigned_by, assigned_to, department, office_location, assignment_type"
        )
        .eq("asset_id", asset.id)

      if (assignmentsError) throw assignmentsError

      // 2. Fetch Issues
      const { data: issues, error: issuesError } = await supabase
        .from("asset_issues")
        .select("id, description, resolved, created_at, resolved_at, created_by, resolved_by")
        .eq("asset_id", asset.id)

      if (issuesError) throw issuesError

      // 3. Fetch Status Changes from Audit Logs
      const { data: auditLogs, error: auditError } = await supabase
        .from("audit_logs")
        .select("id, operation, old_values, new_values, created_at, user_id")
        .eq("table_name", "assets")
        .eq("record_id", asset.id)
        .eq("operation", "UPDATE")

      if (auditError) throw auditError

      // 4. Resolve User Names
      const userIds = new Set<string>()
      assignments?.forEach((a) => {
        if (a.assigned_by) userIds.add(a.assigned_by)
        if (a.assigned_to) userIds.add(a.assigned_to)
      })
      issues?.forEach((i) => {
        if (i.created_by) userIds.add(i.created_by)
        if (i.resolved_by) userIds.add(i.resolved_by)
      })
      auditLogs?.forEach((l) => {
        if (l.user_id) userIds.add(l.user_id)
      })

      let usersMap = new Map<string, ProfileNameRow>()
      if (userIds.size > 0) {
        const { data: usersData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", Array.from(userIds))
        if (usersData) usersMap = new Map((usersData as ProfileNameRow[]).map((u) => [u.id, u] as const))
      }

      const getUName = (id: string | null | undefined) => {
        if (!id) return null
        const u = usersMap.get(id)
        return u ? `${formatName(u.first_name)} ${formatName(u.last_name)}` : "System"
      }

      // 5. Transform into unified Activity list
      const activities: AssetActivity[] = []

      // Add Assignments & Handovers
      assignments?.forEach((a) => {
        // The Assignment itself
        activities.push({
          id: `${a.id}-assign`,
          timestamp: a.assigned_at,
          type: "assignment",
          title: "Asset Assigned",
          user_name: a.assigned_to
            ? getUName(a.assigned_to) || a.department || a.office_location || "Office"
            : a.department || a.office_location || "Office",
          performed_by_name: getUName(a.assigned_by) || "System Admin",
          details: {
            notes: a.assignment_notes,
            assignment_type: a.assignment_type,
          },
        })

        // The Handover/Return (if closed)
        if (a.handed_over_at) {
          activities.push({
            id: `${a.id}-return`,
            timestamp: a.handed_over_at,
            type: "unassignment",
            title: "Asset Returned / Unassigned",
            user_name: a.assigned_to
              ? getUName(a.assigned_to) || a.department || a.office_location || "Office"
              : a.department || a.office_location || "Office",
            details: {
              notes: a.handover_notes,
            },
          })
        }
      })

      // Add Issues
      issues?.forEach((i) => {
        activities.push({
          id: `${i.id}-issue`,
          timestamp: i.created_at,
          type: "issue_reported",
          title: "Issue Reported",
          description: i.description,
          performed_by_name: getUName(i.created_by) || "System Admin",
        })

        if (i.resolved && i.resolved_at) {
          activities.push({
            id: `${i.id}-resolved`,
            timestamp: i.resolved_at,
            type: "issue_resolved",
            title: "Issue Resolved",
            performed_by_name: getUName(i.resolved_by) || "System Admin",
          })
        }
      })

      // Add Status Changes (filter for meaningful changes)
      auditLogs?.forEach((l) => {
        const oldStatus = l.old_values?.status
        const newStatus = l.new_values?.status
        if (newStatus && oldStatus !== newStatus) {
          activities.push({
            id: l.id,
            timestamp: l.created_at,
            type: "status_change",
            title: `Status Changed: ${formatName(newStatus)}`,
            performed_by_name: getUName(l.user_id) || "System Admin",
            details: {
              old_status: oldStatus,
              status: newStatus,
            },
          })
        }
      })

      // Sort chronological (descending)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setAssetHistory(activities)
      setSelectedAsset(asset)
      setIsHistoryOpen(true)
    } catch (error: unknown) {
      log.error("Error loading asset history:", error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`Failed to load history: ${message}`)
    }
  }

  const loadAssetIssues = async (assetId: string) => {
    try {
      const { data, error } = await supabase
        .from("asset_issues")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setAssetIssues(data || [])
    } catch (error: unknown) {
      log.error("Error loading asset issues:", error)
      toast.error("Failed to load asset issues")
    }
  }

  const handleAddIssue = async () => {
    if (!newIssueDescription.trim() || !selectedAsset || isAddingIssue) return

    setIsAddingIssue(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsAddingIssue(false)
        return
      }

      const { error } = await supabase.from("asset_issues").insert({
        asset_id: selectedAsset.id,
        description: newIssueDescription.trim(),
        created_by: user.id,
      })

      if (error) throw error

      toast.success("Issue added")
      setNewIssueDescription("")
      await loadAssetIssues(selectedAsset.id)
      await loadData() // Refresh to update issue counts
    } catch (error: unknown) {
      log.error("Error adding issue:", error)
      toast.error("Failed to add issue")
    } finally {
      setIsAddingIssue(false)
    }
  }

  const handleToggleIssue = async (issue: AssetIssue) => {
    try {
      const { error } = await supabase.from("asset_issues").update({ resolved: !issue.resolved }).eq("id", issue.id)

      if (error) throw error

      toast.success(issue.resolved ? "Issue marked as unresolved" : "Issue marked as resolved")
      if (selectedAsset) {
        await loadAssetIssues(selectedAsset.id)
      }
      await loadData() // Refresh to update issue counts
    } catch (error: unknown) {
      log.error("Error toggling issue:", error)
      toast.error("Failed to update issue")
    }
  }

  const handleDeleteIssue = async (issueId: string) => {
    try {
      const { error } = await supabase.from("asset_issues").delete().eq("id", issueId)

      if (error) throw error

      toast.success("Issue deleted")
      if (selectedAsset) {
        await loadAssetIssues(selectedAsset.id)
      }
      await loadData() // Refresh to update issue counts
    } catch (error: unknown) {
      log.error("Error deleting issue:", error)
      toast.error("Failed to delete issue")
    }
  }

  const handleOpenAssetDialog = async (asset?: Asset) => {
    if (asset) {
      setBatchQuantity(1)
      setSelectedAsset(asset)

      // Fetch current assignment details if asset is assigned
      let assignmentDetails = {
        assigned_by: "",
        assigned_at: "",
        assigned_to: "",
        department: "",
        office_location: "",
        assignment_notes: "",
      }

      if (asset.status === "assigned" || asset.status === "retired" || asset.status === "maintenance") {
        const { data, error: assignmentFetchError } = await supabase
          .from("asset_assignments")
          .select("assigned_by, assigned_at, assigned_to, department, office_location, assignment_notes")
          .eq("asset_id", asset.id)
          .eq("is_current", true)
          .single()

        if (assignmentFetchError && assignmentFetchError.code !== "PGRST116") {
          log.error("Error fetching current assignment:", assignmentFetchError)
        }

        if (data) {
          assignmentDetails = {
            assigned_by: data.assigned_by || "",
            assigned_at: data.assigned_at ? new Date(data.assigned_at).toISOString().slice(0, 16) : "",
            assigned_to: data.assigned_to || "",
            department: data.department || "",
            office_location: data.office_location || "",
            assignment_notes: data.assignment_notes || "",
          }
        }
      }

      const formData = {
        asset_type: asset.asset_type,
        acquisition_year: asset.acquisition_year,
        asset_model: asset.asset_model || "",
        serial_number: asset.serial_number || "",
        unique_code: asset.unique_code,
        status: asset.status,
        notes: asset.notes || "",
        assignment_type: (asset.assignment_type as "individual" | "department" | "office") || "individual",
        assigned_to: assignmentDetails.assigned_to,
        assignment_department: assignmentDetails.department,
        office_location: assignmentDetails.office_location,
        assignment_notes: assignmentDetails.assignment_notes,
        assigned_by: assignmentDetails.assigned_by,
        assigned_at: assignmentDetails.assigned_at,
      }
      setAssetForm(formData)
      // Store original values for change detection
      setOriginalAssetForm({
        asset_type: asset.asset_type,
        acquisition_year: asset.acquisition_year,
        asset_model: asset.asset_model || "",
        serial_number: asset.serial_number || "",
        unique_code: asset.unique_code,
        status: asset.status,
        notes: asset.notes || "",
        // Include assignment details for change detection
        assignment_type: formData.assignment_type,
        assigned_to: formData.assigned_to,
        assignment_department: formData.assignment_department,
        office_location: formData.office_location,
        assignment_notes: formData.assignment_notes,
        assigned_by: formData.assigned_by,
        assigned_at: formData.assigned_at,
      })
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setBatchQuantity(1)
      setSelectedAsset(null)
      setAssetForm({
        asset_type: "",
        acquisition_year: currentYear,
        asset_model: "",
        serial_number: "",
        unique_code: "",
        status: "available",
        notes: "",
        assignment_type: "individual",
        assigned_to: "",
        assignment_department: "",
        office_location: "",
        assignment_notes: "",
        assigned_by: user?.id || "",
        assigned_at: new Date().toISOString().slice(0, 16),
      })
      setOriginalAssetForm({
        asset_type: "",
        acquisition_year: currentYear,
        asset_model: "",
        serial_number: "",
        unique_code: "",
        status: "available",
        notes: "",
        assignment_type: "individual",
        assigned_to: "",
        assignment_department: "",
        office_location: "",
        assignment_notes: "",
        assigned_by: user?.id || "",
        assigned_at: new Date().toISOString().slice(0, 16),
      })
    }
    setIsAssetDialogOpen(true)
  }

  const handleOpenIssuesDialog = async (asset: Asset) => {
    setSelectedAsset(asset)
    await loadAssetIssues(asset.id)
    setNewIssueDescription("")
    setIsIssuesDialogOpen(true)
  }

  const handleSaveAsset = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      if (!assetForm.asset_type) {
        toast.error("Please select an asset type")
        setIsSaving(false)
        return
      }

      if (!selectedAsset) {
        if (!Number.isInteger(batchQuantity) || batchQuantity < 1 || batchQuantity > 100) {
          toast.error("Quantity must be between 1 and 100")
          setIsSaving(false)
          return
        }

        if (batchQuantity > 1 && String(assetForm.serial_number || "").trim()) {
          toast.error("For batch creation, leave Serial Number empty. You can edit each asset later if needed.")
          setIsSaving(false)
          return
        }
      }

      const response = await fetch("/api/admin/assets", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: selectedAsset ? "update" : "create",
          assetForm,
          quantity: selectedAsset ? 1 : batchQuantity,
          selectedAsset: selectedAsset ? { id: selectedAsset.id, status: selectedAsset.status } : null,
          originalAssetForm: selectedAsset
            ? {
                assigned_to: originalAssetForm.assigned_to,
                assignment_department: originalAssetForm.assignment_department,
                office_location: originalAssetForm.office_location,
              }
            : null,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save asset")
      }

      toast.success(payload?.message || (selectedAsset ? "Asset updated successfully" : "Asset created successfully"))

      setIsAssetDialogOpen(false)
      loadData()
    } catch (error: unknown) {
      log.error("Error saving asset:", error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`Failed to save asset: ${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAssignAsset = async () => {
    if (isAssigning) return
    setIsAssigning(true)
    try {
      if (!selectedAsset) {
        setIsAssigning(false)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsAssigning(false)
        return
      }

      // Validate
      const validationError = assignmentValidation.validateAssignment(
        assignForm.assignment_type,
        assignForm.assigned_to,
        assignForm.department,
        assignForm.office_location
      )
      if (validationError) {
        toast.error(validationError)
        setIsAssigning(false)
        return
      }

      // Use RPC for atomic reassignment
      const { error: rpcError } = await supabase.rpc("reassign_asset", {
        p_asset_id: selectedAsset.id,
        p_new_assignment_type: assignForm.assignment_type,
        p_assigned_to: assignForm.assigned_to || null,
        p_department: assignForm.department || null,
        p_office_location: assignForm.office_location || null,
        p_assigned_by: assignForm.assigned_by || user.id,
        p_assigned_at: assignForm.assigned_at
          ? new Date(assignForm.assigned_at).toISOString()
          : new Date().toISOString(),
        p_assignment_notes: assignForm.assignment_notes || null,
        p_handover_notes: "Reassigned",
        p_new_status: "assigned",
      })

      if (rpcError) throw rpcError

      toast.success("Asset reassigned successfully")
      setIsAssignDialogOpen(false)
      loadData()
    } catch (error: unknown) {
      log.error("Error assigning asset:", error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`Failed: ${message}`)
    } finally {
      setIsAssigning(false)
    }
  }

  const handleDeleteAsset = async () => {
    if (isDeleting) return // Prevent duplicate submissions
    setIsDeleting(true)
    try {
      if (!assetToDelete) {
        setIsDeleting(false)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsDeleting(false)
        return
      }

      const isArchived = Boolean(assetToDelete.deleted_at)
      if (isArchived) {
        toast.error("Asset is already archived")
        setIsDeleting(false)
        return
      }

      // Only check for active assignments if the asset status is "assigned"
      if (assetToDelete.status === "assigned") {
        const { data: assignments } = await supabase
          .from("asset_assignments")
          .select("*")
          .eq("asset_id", assetToDelete.id)
          .eq("is_current", true)

        if (assignments && assignments.length > 0) {
          toast.error("Cannot archive asset with active assignments. Please return or reassign first.")
          setIsDeleting(false)
          return
        }
      }

      const { error } = await supabase
        .from("assets")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          delete_reason: "Archived from Admin Assets",
          updated_at: new Date().toISOString(),
        })
        .eq("id", assetToDelete.id)

      if (error) throw error

      toast.success("Asset archived. You can restore it later.")
      setIsDeleteDialogOpen(false)
      setAssetToDelete(null)
      loadData()
    } catch (error: unknown) {
      log.error("Error archiving asset:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to archive asset"
      toast.error(`Failed to archive asset: ${errorMessage}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRestoreAsset = async (asset: Asset) => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from("assets")
        .update({
          deleted_at: null,
          deleted_by: null,
          delete_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", asset.id)

      if (error) throw error
      toast.success("Asset restored successfully")
      await loadData()
    } catch (error: unknown) {
      log.error("Error restoring asset:", error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`Failed to restore asset: ${message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  // Sorting function
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const getEffectiveAssignmentType = (asset: AssignableAsset) =>
    (asset.current_assignment?.assignment_type || asset.assignment_type || "").toLowerCase()

  const getAssignedPersonName = (asset: AssignableAsset) => {
    const assignedId = asset.current_assignment?.assigned_to
    if (!assignedId) return null

    const assignmentUser = asset.current_assignment?.user
    const employeeUser = employees.find((member) => member.id === assignedId)
    const firstName = assignmentUser?.first_name || employeeUser?.first_name || ""
    const lastName = assignmentUser?.last_name || employeeUser?.last_name || ""
    const fullName = `${formatName(firstName)} ${formatName(lastName)}`.trim()

    return fullName || "Assigned User"
  }

  const getAssignedToLabel = (asset: AssignableAsset, withStatusSuffix = false) => {
    const isAssignedLike = asset.status === "assigned" || asset.status === "retired" || asset.status === "maintenance"
    if (!isAssignedLike) return "Unassigned"

    const statusSuffix =
      withStatusSuffix && (asset.status === "retired" || asset.status === "maintenance") ? ` (${asset.status})` : ""

    const assignmentType = getEffectiveAssignmentType(asset)
    if (assignmentType === "office") {
      return `${asset.current_assignment?.office_location || asset.office_location || "Office"}${statusSuffix}`
    }

    if (assignmentType === "department") {
      return `${asset.current_assignment?.department || asset.department || "Assigned Department"}${statusSuffix}`
    }

    const personName = getAssignedPersonName(asset)
    if (personName) return `${personName}${statusSuffix}`
    if (asset.current_assignment?.department) return `${asset.current_assignment.department}${statusSuffix}`

    return `Assigned${statusSuffix}`
  }

  const getCreatedByLabel = (createdBy: string) => {
    const creator = employees.find((employee) => employee.id === createdBy)
    if (!creator) return "Unknown user"

    const fullName = `${formatName(creator.first_name)} ${formatName(creator.last_name)}`.trim()
    return fullName || creator.company_email || "Unknown user"
  }

  const getSortedAssets = (assetsToSort: Asset[]) => {
    if (!sortConfig) return assetsToSort

    const sorted = [...assetsToSort].sort((a, b) => {
      let aValue: SortableValue
      let bValue: SortableValue

      switch (sortConfig.key) {
        case "unique_code":
          aValue = a.unique_code
          bValue = b.unique_code
          break
        case "asset_type":
          aValue = ASSET_TYPE_MAP[a.asset_type]?.label || a.asset_type
          bValue = ASSET_TYPE_MAP[b.asset_type]?.label || b.asset_type
          break
        case "model":
          aValue = a.asset_model || ""
          bValue = b.asset_model || ""
          break
        case "year":
          aValue = a.acquisition_year || 0
          bValue = b.acquisition_year || 0
          break
        case "status":
          aValue = a.status
          bValue = b.status
          break
        case "assigned_to":
          aValue = getAssignedToLabel(a)
          bValue = getAssignedToLabel(b)
          break
        default:
          return 0
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      if (sortConfig.direction === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })

    return sorted
  }

  // Export functions
  const handleExportClick = (type: "excel" | "pdf" | "word") => {
    setExportType(type)
    setExportDialogOpen(true)
  }

  const handleExportConfirm = async () => {
    const rows = buildAssetExportRows(
      getSortedAssets(filteredAssets),
      { selectedColumns, employees, getDepartmentForOffice },
      (asset, withStatus) => getAssignedToLabel(asset, withStatus)
    )
    const filename = `assets-export-${new Date().toISOString().split("T")[0]}`
    if (exportType === "excel") await exportAssetsToExcel(rows, filename)
    else if (exportType === "pdf")
      await exportAssetsToPDF(rows, filename, { total: getSortedAssets(filteredAssets).length })
    else if (exportType === "word") await exportAssetsToWord(rows, filename)
    setExportDialogOpen(false)
  }

  const handleEmployeeReportClick = (type: "excel" | "pdf" | "word") => {
    const availableTypes: Record<string, boolean> = {}
    assetTypes.forEach((t) => {
      availableTypes[t.code] = true
    })
    setEmployeeReportSelectedTypes(availableTypes)
    setEmployeeReportExportType(type)
    setEmployeeReportDialogOpen(true)
  }

  const handleEmployeeReportConfirm = async () => {
    const input = {
      employees,
      assets,
      selectedTypes: employeeReportSelectedTypes,
      assetTypeMap: ASSET_TYPE_MAP,
    }
    const filename = `employees-assets-report-${new Date().toISOString().split("T")[0]}`
    if (employeeReportExportType === "excel") await exportEmployeeReportToExcel(input, filename)
    else if (employeeReportExportType === "pdf") await exportEmployeeReportToPDF(input, filename)
    else if (employeeReportExportType === "word") await exportEmployeeReportToWord(input, filename)
    setEmployeeReportDialogOpen(false)
  }

  const filteredAssets = assets.filter((asset) => {
    const computedStatus = asset.deleted_at ? "archived" : asset.status
    const assetTypeLabel = ASSET_TYPE_MAP[asset.asset_type]?.label || asset.asset_type

    // Enhanced search - now searches across all relevant fields
    const matchesSearch =
      searchQuery === "" ||
      [
        asset.unique_code,
        assetTypeLabel,
        asset.asset_model,
        asset.serial_number,
        asset.acquisition_year?.toString(),
        computedStatus,
        asset.notes,
        asset.department,
        asset.office_location,
        getAssignedPersonName(asset),
        asset.current_assignment?.department,
      ].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus = statusFilter.length === 0 ? !asset.deleted_at : statusFilter.includes(computedStatus)
    const matchesYear = yearFilter.length === 0 || yearFilter.includes(asset.acquisition_year?.toString() || "")
    const matchesAssetType = assetTypeFilter.length === 0 || assetTypeFilter.includes(asset.asset_type)
    const matchesOfficeLocation =
      officeLocationFilter.length === 0 ||
      officeLocationFilter.includes(asset.office_location || "") ||
      officeLocationFilter.includes(asset.current_assignment?.office_location || "")

    // Filter by issue status
    const matchesIssueStatus =
      issueStatusFilter.length === 0 ||
      (issueStatusFilter.includes("has_issues") && (asset.unresolved_issues_count || 0) > 0) ||
      (issueStatusFilter.includes("no_issues") && (asset.unresolved_issues_count || 0) === 0)

    // Filter by department - for leads, always filter by their departments
    let matchesDepartment = true
    if (userProfile?.is_department_lead) {
      // Leads: assets are already filtered, but ensure they match lead's departments
      if (scopedDepartments.length > 0 || scopedOffices.length > 0) {
        const assignmentDept = asset.current_assignment?.department
        const assignedUserDept = asset.current_assignment?.assigned_to
          ? employees.find((s) => s.id === asset.current_assignment?.assigned_to)?.department
          : null
        const assignmentOffice = asset.current_assignment?.office_location

        matchesDepartment =
          (assignmentDept ? scopedDepartments.includes(assignmentDept) : false) ||
          (assignedUserDept ? scopedDepartments.includes(assignedUserDept) : false) ||
          (assignmentOffice ? scopedOffices.includes(assignmentOffice) : false)
      }
    } else {
      // Admins: use department filter
      matchesDepartment =
        departmentFilter.length === 0 || departmentFilter.includes(asset.current_assignment?.department || "")
    }

    // Filter by user
    const matchesUser = userFilter.length === 0 || userFilter.includes(asset.current_assignment?.assigned_to || "")

    return (
      matchesSearch &&
      matchesStatus &&
      matchesDepartment &&
      matchesUser &&
      matchesYear &&
      matchesAssetType &&
      matchesOfficeLocation &&
      matchesIssueStatus
    )
  })

  const stats = {
    total: assets.filter((d) => !d.deleted_at).length,
    available: assets.filter((d) => !d.deleted_at && d.status === "available").length,
    assigned: assets.filter((d) => !d.deleted_at && d.status === "assigned").length,
    maintenance: assets.filter((d) => !d.deleted_at && d.status === "maintenance").length,
    archived: assets.filter((d) => !!d.deleted_at).length,
    unresolvedIssues: assets
      .filter((d) => !d.deleted_at)
      .reduce((sum, asset) => sum + (asset.unresolved_issues_count || 0), 0),
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "assigned":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "available":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "maintenance":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "retired":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
      case "archived":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  if (isLoading) {
    return (
      <div className="from-background via-background to-muted/20 flex min-h-screen w-full items-center justify-center bg-gradient-to-br">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading assets...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminTablePage
      title="Asset Management"
      description="Manage asset inventory and assignments"
      icon={Package}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <TableViewToggle viewMode={viewMode} onChange={setViewMode} />
          <Button variant="outline" onClick={() => setExportOptionsOpen(true)} className="h-8 gap-2" size="sm">
            <Download className="h-4 w-4" />
            Export
          </Button>
          {!userProfile?.is_department_lead && (
            <Button onClick={() => handleOpenAssetDialog()} className="h-8 gap-2" size="sm">
              <Plus className="h-4 w-4" />
              Add Asset
            </Button>
          )}
        </div>
      }
      stats={
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-5 md:gap-4">
          <StatCard
            title="Total assets"
            value={stats.total}
            icon={Package}
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />

          <StatCard
            title="Available"
            value={stats.available}
            icon={Package}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />

          <StatCard
            title="Assigned"
            value={stats.assigned}
            icon={Package}
            iconBgColor="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
          />

          <StatCard
            title="Maintenance"
            value={stats.maintenance}
            icon={Package}
            iconBgColor="bg-yellow-100 dark:bg-yellow-900/30"
            iconColor="text-yellow-600 dark:text-yellow-400"
          />

          <Card
            className="cursor-pointer border-2 transition-all hover:border-orange-300 hover:shadow-lg dark:hover:border-orange-700"
            onClick={() => router.push("/admin/assets/issues")}
          >
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Issues</p>
                  <p className="mt-1 text-lg font-bold text-orange-600 sm:text-xl md:mt-2 md:text-3xl dark:text-orange-400">
                    {stats.unresolvedIssues}
                  </p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-orange-100 p-1.5 sm:p-2 md:p-3 dark:bg-orange-900/30">
                  <AlertCircle className="h-4 w-4 text-orange-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      }
      filters={
        <AssetFilterBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          departmentFilter={departmentFilter}
          setDepartmentFilter={setDepartmentFilter}
          userFilter={userFilter}
          setUserFilter={setUserFilter}
          yearFilter={yearFilter}
          setYearFilter={setYearFilter}
          officeLocationFilter={officeLocationFilter}
          setOfficeLocationFilter={setOfficeLocationFilter}
          assetTypeFilter={assetTypeFilter}
          setAssetTypeFilter={setAssetTypeFilter}
          issueStatusFilter={issueStatusFilter}
          setIssueStatusFilter={setIssueStatusFilter}
          assetTypes={assetTypes}
          departments={departments}
          activeEmployees={activeEmployees}
          acquisitionYears={Array.from(new Set(assets.map((a) => a.acquisition_year)))}
          isDepartmentLead={!!userProfile?.is_department_lead}
        />
      }
      filtersInCard={false}
    >
      <AssetListView
        assets={getSortedAssets(filteredAssets)}
        viewMode={viewMode}
        userProfile={userProfile}
        isDeleting={isDeleting}
        onEdit={handleOpenAssetDialog}
        onIssues={handleOpenIssuesDialog}
        onHistory={loadAssetHistory}
        onDelete={(asset) => {
          setAssetToDelete(asset)
          setIsDeleteDialogOpen(true)
        }}
        onRestore={handleRestoreAsset}
        getStatusColor={getStatusColor}
        getEffectiveAssignmentType={getEffectiveAssignmentType}
        getAssignedPersonName={getAssignedPersonName}
        getCreatedByLabel={getCreatedByLabel}
        sortConfig={sortConfig}
        onSort={handleSort}
        hasActiveFilters={
          Boolean(searchQuery) ||
          statusFilter.length > 0 ||
          departmentFilter.length > 0 ||
          userFilter.length > 0 ||
          assetTypeFilter.length > 0 ||
          yearFilter.length > 0 ||
          officeLocationFilter.length > 0 ||
          issueStatusFilter.length > 0
        }
      />
      {/* asset Dialog */}
      <AssetFormDialog
        isOpen={isAssetDialogOpen}
        onOpenChange={setIsAssetDialogOpen}
        selectedAsset={selectedAsset}
        assetForm={assetForm}
        setAssetForm={setAssetForm}
        originalAssetForm={originalAssetForm}
        assetTypes={assetTypes}
        employees={employees}
        activeEmployees={activeEmployees}
        departments={departments}
        onSave={handleSaveAsset}
        isSaving={isSaving}
        canCreateAssetType={canCreateAssetType}
        onOpenCreateAssetType={() => setIsCreateAssetTypeDialogOpen(true)}
        batchQuantity={batchQuantity}
        setBatchQuantity={setBatchQuantity}
      />

      {/* Assign Dialog */}
      <AssetAssignDialog
        isOpen={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        selectedAsset={selectedAsset}
        assignForm={assignForm}
        setAssignForm={setAssignForm}
        currentAssignment={currentAssignment}
        onAssign={handleAssignAsset}
        employees={employees}
        activeEmployees={activeEmployees}
        departments={departments}
        isAssigning={isAssigning}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive &quot;{assetToDelete?.unique_code}&quot; (
              {ASSET_TYPE_MAP[assetToDelete?.asset_type || ""]?.label}
              ). Archived assets are recoverable and not permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssetToDelete(null)} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <Button onClick={handleDeleteAsset} loading={isDeleting} className="bg-red-600 text-white hover:bg-red-700">
              Archive
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* asset History Dialog */}
      <AssetHistoryDialog
        isOpen={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        selectedAsset={selectedAsset}
        assetHistory={assetHistory}
      />

      {/* Asset Issues Dialog */}
      <AssetIssuesDialog
        isOpen={isIssuesDialogOpen}
        onOpenChange={setIsIssuesDialogOpen}
        selectedAsset={selectedAsset}
        assetIssues={assetIssues}
        newIssueDescription={newIssueDescription}
        setNewIssueDescription={setNewIssueDescription}
        onAddIssue={handleAddIssue}
        onToggleIssue={handleToggleIssue}
        onDeleteIssue={handleDeleteIssue}
        isAddingIssue={isAddingIssue}
      />

      {/* Create Asset Type Dialog */}
      <AssetTypeDialog
        isOpen={isCreateAssetTypeDialogOpen}
        onOpenChange={setIsCreateAssetTypeDialogOpen}
        newAssetType={newAssetType}
        setNewAssetType={setNewAssetType}
        onCreateAssetType={handleCreateAssetType}
        isCreatingAssetType={isCreatingAssetType}
      />

      {/* Export Column Selection Dialog */}
      <AssetExportDialog
        isOpen={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        exportType={exportType}
        selectedColumns={selectedColumns}
        setSelectedColumns={setSelectedColumns}
        onExportConfirm={handleExportConfirm}
      />

      {/* Employee Assets Report Confirmation Dialog */}
      <EmployeeAssetsReportDialog
        isOpen={employeeReportDialogOpen}
        onOpenChange={setEmployeeReportDialogOpen}
        employeeReportExportType={employeeReportExportType}
        employeeReportSelectedTypes={employeeReportSelectedTypes}
        setEmployeeReportSelectedTypes={setEmployeeReportSelectedTypes}
        assetTypes={assetTypes}
        employeesCount={employees.length}
        onConfirm={handleEmployeeReportConfirm}
      />

      <ExportOptionsDialog
        open={exportOptionsOpen}
        onOpenChange={setExportOptionsOpen}
        title="Export Assets"
        options={[
          { id: "asset_excel", label: "Assets: Excel (.xlsx)", icon: "excel" },
          { id: "asset_pdf", label: "Assets: PDF", icon: "pdf" },
          { id: "asset_word", label: "Assets: Word (.docx)", icon: "word" },
          { id: "employee_excel", label: "Employee Report: Excel (.xlsx)", icon: "excel" },
          { id: "employee_pdf", label: "Employee Report: PDF", icon: "pdf" },
          { id: "employee_word", label: "Employee Report: Word (.docx)", icon: "word" },
        ]}
        onSelect={(id) => {
          if (id === "asset_excel") return handleExportClick("excel")
          if (id === "asset_pdf") return handleExportClick("pdf")
          if (id === "asset_word") return handleExportClick("word")
          if (id === "employee_excel") return handleEmployeeReportClick("excel")
          if (id === "employee_pdf") return handleEmployeeReportClick("pdf")
          handleEmployeeReportClick("word")
        }}
      />
    </AdminTablePage>
  )
}
