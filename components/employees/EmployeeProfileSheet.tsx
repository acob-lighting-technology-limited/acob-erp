"use client"

import { useState, useCallback } from "react"
import { formatDDMMYYYY } from "@/lib/utils/date"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmployeeStatusBadge } from "@/components/hr/employee-status-badge"
import { SignatureCreator } from "@/components/signature-creator"
import { formatName, cn } from "@/lib/utils"
import { Edit, FileSignature, User, Briefcase, Mail, Copy, Check } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import type { UserRole, EmploymentStatus } from "@/types/database"
import { getRoleDisplayName, getRoleBadgeColor } from "@/lib/permissions"
import { useDepartments } from "@/hooks/use-departments"
import { useOfficeLocations } from "@/hooks/use-office-locations"
import { QUERY_KEYS } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import type { UserProfile } from "@/app/admin/hr/employees/admin-employee-content"
import type { EmployeeAssignedItems, EmployeeProfile, EmployeeViewData } from "./types"
import { EmployeeEditForm, type EditForm } from "./employee-edit-form"
import type { EmployeeMailboxActions } from "@/lib/employees/mailbox-state"

export interface EmployeeProfileSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeProfile | null
  assignedItems: EmployeeAssignedItems
  modalViewMode: "profile" | "employment" | "edit" | "signature"
  setModalViewMode: (mode: "profile" | "employment" | "edit" | "signature") => void
  onSave: () => void
  isSaving: boolean
  editForm: EditForm
  setEditForm: (form: EditForm | ((prev: EditForm) => EditForm)) => void
  userProfile: UserProfile
  viewEmployeeData: EmployeeViewData
  onEditEmployee: (employee: EmployeeProfile) => void
  onSignature: (employee: EmployeeProfile) => void
  onDispatchCredentials?: (employee: EmployeeProfile) => void
  canManageUsers: boolean
  getAvailableRoles: () => UserRole[]
}

function getAssetStatusColor(status: string | null | undefined): string {
  switch (status?.toLowerCase()) {
    case "assigned":
    case "active":
    case "resolved":
    case "completed":
    case "approved":
      return "bg-success/15 text-success"
    case "in_progress":
    case "under_review":
      return "bg-info/15 text-info"
    case "pending":
    case "open":
      return "bg-warning/15 text-warning"
    default:
      return "bg-muted text-foreground"
  }
}

function StaffTypeBadge({
  type,
  categoryName,
  className,
}: {
  type?: string | null
  categoryName?: string | null
  className?: string
}) {
  const normType = type || "full_time"
  const isPartTime = normType === "part_time"
  const isContract = normType === "contract"

  let label = normType.replace(/_/g, " ")
  let colorClasses = "border-info/30 bg-blue-500/10 text-blue-600"

  if (isPartTime) {
    label = "Part Time"
    colorClasses = "border-border bg-slate-500/10 text-slate-600"
  } else if (categoryName) {
    label = categoryName
    const catUpper = categoryName.toUpperCase()
    if (catUpper.includes("NYSC")) {
      colorClasses = "border-purple/30 bg-purple/10 text-purple-600"
    } else if (catUpper.includes("SIWES") || catUpper.includes("INTERN")) {
      colorClasses = "border-info/30 bg-cyan-500/10 text-cyan-600"
    } else if (catUpper.includes("NEXT") || catUpper.includes("GEN")) {
      colorClasses = "border-success/30 bg-emerald-500/10 text-emerald-600"
    } else {
      colorClasses = "border-warning/30 bg-orange-500/10 text-orange-600"
    }
  } else if (isContract) {
    label = "Contract Staff"
    colorClasses = "border-warning/30 bg-orange-500/10 text-orange-600"
  } else {
    label = "Full Time"
    colorClasses = "border-info/30 bg-blue-500/10 text-blue-600"
  }

  return (
    <Badge variant="outline" className={cn("text-xs font-medium", colorClasses, className)}>
      {label}
    </Badge>
  )
}

export function EmployeeProfileSheet({
  isOpen,
  onOpenChange,
  employee,
  assignedItems: _assignedItems,
  modalViewMode,
  setModalViewMode,
  onSave,
  isSaving,
  editForm,
  setEditForm,
  userProfile,
  viewEmployeeData,
  onEditEmployee,
  onSignature,
  onDispatchCredentials,
  canManageUsers,
  getAvailableRoles,
}: EmployeeProfileSheetProps) {
  const { departments: DEPARTMENTS } = useDepartments()
  const { officeLocations } = useOfficeLocations()
  const supabase = createClient()
  const [innerTab, setInnerTab] = useState<"assets" | "tasks" | "docs">("assets")
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Stable, and a no-op when nothing changed, so the section's effect cannot
  // loop through setEditForm.
  const handleMailboxActionsChange = useCallback(
    (actions: EmployeeMailboxActions | undefined, invalid: boolean) => {
      setEditForm((prev) =>
        JSON.stringify(prev.mailbox_actions) === JSON.stringify(actions) &&
        Boolean(prev.mailbox_actions_invalid) === invalid
          ? prev
          : { ...prev, mailbox_actions: actions, mailbox_actions_invalid: invalid }
      )
    },
    [setEditForm]
  )

  const handleCopy = useCallback((text: string, fieldName: string) => {
    if (!text) return
    void navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`Copied ${fieldName}`)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  const { data: contractCategories = [] } = useQuery<Array<{ id: string; name: string; code: string }>>({
    queryKey: QUERY_KEYS.contractCategories(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_categories")
        .select("id, name, code")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
      if (error) throw error
      return (data || []) as Array<{ id: string; name: string; code: string }>
    },
    enabled: isOpen,
  })

  const viewEmployeeProfile = employee
  const staffAvatars = useStaffAvatars()
  const displayedLeadDepartments =
    viewEmployeeProfile?.is_department_lead && viewEmployeeProfile.department
      ? [viewEmployeeProfile.department]
      : viewEmployeeProfile?.lead_departments || []

  const isMainView = modalViewMode === "profile" || modalViewMode === "employment" || modalViewMode === "signature"
  const isSubView = modalViewMode === "edit"

  const MAIN_TABS = [
    { mode: "profile" as const, label: "Overview", icon: User },
    { mode: "employment" as const, label: "Employment", icon: Briefcase },
    { mode: "signature" as const, label: "Signature", icon: FileSignature },
  ]

  const originalType = viewEmployeeProfile?.employment_type || "full_time"
  const originalCategoryCode = viewEmployeeProfile?.contract_categories?.code || ""
  const isTypeOrCategoryChanged =
    editForm.employment_type !== originalType ||
    (editForm.employment_type === "contract" && editForm.contract_category_code !== originalCategoryCode)

  const currentYear = new Date().getFullYear()
  const expectedIdPreview =
    editForm.employment_type === "full_time"
      ? `ACOB/${currentYear}/...`
      : editForm.employment_type === "part_time"
        ? `ACOB/PT/${currentYear}/...`
        : `ACOB/${editForm.contract_category_code || "SIWES"}/${currentYear}/...`

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-full w-full flex-col gap-0 overflow-hidden p-0 transition-[max-width] duration-200",
          modalViewMode === "signature" ? "sm:max-w-4xl" : "sm:max-w-2xl"
        )}
      >
        {/* pr-12 keeps the title clear of the sheet's close button */}
        <SheetHeader className="bg-muted/20 space-y-0 border-b py-3.5 pr-12 pl-5 sm:pl-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {viewEmployeeProfile && (
                <StaffAvatar
                  name={`${formatName(viewEmployeeProfile.first_name)} ${formatName(viewEmployeeProfile.last_name)}`}
                  src={staffAvatars[viewEmployeeProfile.id]}
                  profileId={viewEmployeeProfile.id}
                  size="md"
                  className="border"
                />
              )}
              <div className="min-w-0">
                <SheetTitle className="flex flex-wrap items-center gap-2 text-base font-semibold">
                  <span className="truncate">
                    {modalViewMode === "edit"
                      ? "Edit Employee Profile & Status"
                      : modalViewMode === "signature"
                        ? "Email Signature"
                        : viewEmployeeProfile
                          ? `${formatName(viewEmployeeProfile.first_name)} ${formatName(viewEmployeeProfile.last_name)}`
                          : "Employee Details"}
                  </span>
                </SheetTitle>
                <SheetDescription className="text-muted-foreground truncate text-xs">
                  {modalViewMode === "edit"
                    ? "Update identity, work, status, staff type, and contact details in one place."
                    : modalViewMode === "signature"
                      ? "Official company email signature template."
                      : viewEmployeeProfile?.designation || "Employee profile overview and employment history."}
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        {viewEmployeeProfile && isMainView && (
          <div className="bg-background border-b px-5 sm:px-6">
            <div className="flex gap-1">
              {MAIN_TABS.map(({ mode, label, icon: TabIcon }) => {
                const isActive = modalViewMode === mode
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      if (mode === "signature" && viewEmployeeProfile) {
                        onSignature(viewEmployeeProfile)
                      } else {
                        setModalViewMode(mode)
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors",
                      isActive
                        ? "border-primary text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground border-transparent"
                    )}
                  >
                    <TabIcon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {viewEmployeeProfile && modalViewMode === "profile" && (
            <ScrollArea className="h-full">
              <div className="space-y-4 p-5 sm:p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="bg-card space-y-3 rounded-lg border p-4 shadow-xs">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase">
                        <Briefcase className="text-primary h-3.5 w-3.5" /> Work & Organization
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-xs">Department</span>
                        <span className="text-foreground mt-0.5 block truncate text-xs font-medium">
                          {viewEmployeeProfile.department || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Designation</span>
                        <span className="text-foreground mt-0.5 block truncate text-xs font-medium">
                          {viewEmployeeProfile.designation || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Role</span>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <Badge
                            className={cn(
                              "px-1.5 py-0 text-xs",
                              getRoleBadgeColor(viewEmployeeProfile.role as UserRole)
                            )}
                          >
                            {getRoleDisplayName(viewEmployeeProfile.role as UserRole)}
                          </Badge>
                          {viewEmployeeProfile.is_department_lead && (
                            <Badge variant="outline" className="border-amber-300 px-1 py-0 text-xs text-amber-600">
                              Lead
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Office / Room</span>
                        <span className="text-foreground mt-0.5 block truncate text-xs font-medium">
                          {viewEmployeeProfile.office_location || "—"}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center justify-between border-t pt-2">
                        <div>
                          <span className="text-muted-foreground block text-xs">Staff Classification</span>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <StaffTypeBadge
                              type={viewEmployeeProfile.employment_type}
                              categoryName={viewEmployeeProfile.contract_categories?.name}
                            />
                            <span className="text-muted-foreground font-mono text-xs">
                              ({viewEmployeeProfile.employee_number || "No ID"})
                            </span>
                          </div>
                        </div>
                        {displayedLeadDepartments.length > 0 && (
                          <div className="text-right">
                            <span className="text-muted-foreground block text-xs">Leading Depts</span>
                            <span className="text-foreground text-xs font-medium">
                              {displayedLeadDepartments.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 grid grid-cols-2 gap-2 border-t pt-2">
                        <div>
                          <span className="text-muted-foreground block text-xs">Employment Date</span>
                          <span className="text-foreground mt-0.5 block text-xs font-medium">
                            {formatDDMMYYYY(viewEmployeeProfile.employment_date) || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-xs">Confirmation Date</span>
                          <span className="text-foreground mt-0.5 block text-xs font-medium">
                            {formatDDMMYYYY(viewEmployeeProfile.confirmation_date) || "Probation (Pending)"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card space-y-3 rounded-lg border p-4 shadow-xs">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase">
                        <Mail className="text-primary h-3.5 w-3.5" /> Contact Details
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-xs">Company Email</span>
                        <div className="group mt-0.5 flex items-center justify-between">
                          <span className="text-foreground truncate font-mono font-medium select-all">
                            {viewEmployeeProfile.company_email || "—"}
                          </span>
                          {viewEmployeeProfile.company_email && (
                            <Button
                              aria-label="Confirm"
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-60 hover:opacity-100"
                              onClick={() => handleCopy(viewEmployeeProfile.company_email, "Email")}
                            >
                              {copiedField === "Email" ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground block text-xs">Personal Email</span>
                          <span className="text-foreground mt-0.5 block truncate font-mono text-xs">
                            {viewEmployeeProfile.personal_email || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-xs">Phone Number</span>
                          <span className="text-foreground mt-0.5 block truncate font-mono text-xs">
                            {viewEmployeeProfile.phone_number || "—"}
                          </span>
                        </div>
                      </div>
                      {viewEmployeeProfile.residential_address && (
                        <div className="border-t pt-2">
                          <span className="text-muted-foreground block text-xs">Address</span>
                          <span className="text-foreground mt-0.5 line-clamp-2 text-xs">
                            {viewEmployeeProfile.residential_address}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          {viewEmployeeProfile && modalViewMode === "employment" && (
            <ScrollArea className="h-full">
              <div className="space-y-4 p-5 sm:p-6">
                <div className="bg-card space-y-4 rounded-lg border p-4 shadow-xs">
                  <div className="flex flex-col justify-between gap-3 border-b pb-3.5 sm:flex-row sm:items-center">
                    <div>
                      <span className="text-muted-foreground mb-1 block text-xs font-semibold uppercase">
                        Employment Status & Type
                      </span>
                      <div className="flex items-center gap-2">
                        <EmployeeStatusBadge
                          status={(viewEmployeeProfile.employment_status as EmploymentStatus) || "active"}
                          size="lg"
                        />
                        {viewEmployeeProfile.employment_status === "active" &&
                          !viewEmployeeProfile.mailbox_credentials_sent_at && (
                            <Badge
                              variant="outline"
                              className="text-warning border-warning/20 bg-warning/10 px-2 py-0.5 text-xs font-semibold shadow-none"
                            >
                              Mailbox Pending
                            </Badge>
                          )}
                        <StaffTypeBadge
                          type={viewEmployeeProfile.employment_type}
                          categoryName={viewEmployeeProfile.contract_categories?.name}
                          className="px-2 py-0.5"
                        />
                        {viewEmployeeProfile.nysc_cds_day && (
                          <Badge
                            variant="outline"
                            className="text-success border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-semibold capitalize shadow-none"
                          >
                            CDS: {viewEmployeeProfile.nysc_cds_day}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {canManageUsers && (
                      <div className="flex items-center gap-2">
                        {onDispatchCredentials && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (viewEmployeeProfile) onDispatchCredentials(viewEmployeeProfile)
                            }}
                            className="text-primary hover:text-primary h-8 gap-1.5 text-xs"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {viewEmployeeProfile.mailbox_credentials_sent_at
                              ? "Resend Credentials"
                              : "Send Webmail Credentials"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            if (viewEmployeeProfile) onEditEmployee(viewEmployeeProfile)
                          }}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit Employment & Status
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-muted-foreground block text-xs font-semibold uppercase">
                        Employment Date
                      </span>
                      <span className="text-foreground text-sm font-medium">
                        {formatDDMMYYYY(viewEmployeeProfile.employment_date) || "Not specified"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-muted-foreground block text-xs font-semibold uppercase">
                        Confirmation Date
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground text-sm font-medium">
                          {formatDDMMYYYY(viewEmployeeProfile.confirmation_date) || "Not Confirmed"}
                        </span>
                        {!viewEmployeeProfile.confirmation_date && (
                          <Badge variant="secondary" className="text-xs">
                            Probation (Pending)
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          {viewEmployeeProfile && modalViewMode === "edit" && (
            <EmployeeEditForm
              viewEmployeeProfile={viewEmployeeProfile}
              editForm={editForm}
              setEditForm={setEditForm}
              DEPARTMENTS={DEPARTMENTS}
              officeLocations={officeLocations}
              contractCategories={contractCategories}
              getAvailableRoles={getAvailableRoles}
              handleMailboxActionsChange={handleMailboxActionsChange}
              isTypeOrCategoryChanged={isTypeOrCategoryChanged}
              expectedIdPreview={expectedIdPreview}
              canManageUsers={canManageUsers}
            />
          )}

          {viewEmployeeProfile && modalViewMode === "signature" && (
            <ScrollArea className="h-full">
              <div className="p-5 pb-20 sm:p-6">
                <SignatureCreator
                  profile={viewEmployeeProfile}
                  variant="selectable"
                  defaultSelectableMode="anniversary"
                />
              </div>
            </ScrollArea>
          )}
        </div>

        <SheetFooter className="bg-background/95 flex w-full flex-col gap-2 border-t px-5 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            {isSubView && (
              <Button variant="outline" size="sm" onClick={() => setModalViewMode("profile")} disabled={isSaving}>
                ← Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {modalViewMode === "edit" && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setModalViewMode("profile")} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={onSave} loading={isSaving} size="sm">
                  Save Changes
                </Button>
              </>
            )}
            {canManageUsers && modalViewMode === "profile" && (
              <Button
                size="sm"
                onClick={() => {
                  if (viewEmployeeProfile) onEditEmployee(viewEmployeeProfile)
                }}
                className="gap-1.5"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit Profile
              </Button>
            )}
            {canManageUsers && modalViewMode === "employment" && (
              <Button
                size="sm"
                onClick={() => {
                  if (viewEmployeeProfile) onEditEmployee(viewEmployeeProfile)
                }}
                className="gap-1.5"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit Employment & Status
              </Button>
            )}
            {canManageUsers && modalViewMode === "signature" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (viewEmployeeProfile) onSignature(viewEmployeeProfile)
                }}
                className="gap-1.5"
              >
                <FileSignature className="h-3.5 w-3.5" />
                Open Full Signature
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                setModalViewMode("profile")
              }}
            >
              Close
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
