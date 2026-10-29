"use client"

import { useCallback, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, Copy, Edit, FileSignature, Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { DetailList, SectionHeading } from "@/components/ui/detail-list"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { EmployeeStatusBadge } from "@/components/hr/employee-status-badge"
import { SignatureCreator } from "@/components/signature-creator"
import { formatDDMMYYYY } from "@/lib/utils/date"
import { formatName } from "@/lib/utils"
import { EmployeeEditForm } from "./employee-edit-form"
import type { EmployeeProfileSheetProps } from "./EmployeeProfileSheet"
import { useDepartments } from "@/hooks/use-departments"
import { useOfficeLocations } from "@/hooks/use-office-locations"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { EmployeeMailboxActions } from "@/lib/employees/mailbox-state"

export function EmployeeProfileSheetView(props: EmployeeProfileSheetProps) {
  const { employee, modalViewMode, setModalViewMode, onOpenChange, isOpen, canManageUsers } = props
  const { departments } = useDepartments()
  const { officeLocations } = useOfficeLocations()
  const supabase = createClient()
  const [copied, setCopied] = useState(false)
  const name = employee ? `${formatName(employee.first_name)} ${formatName(employee.last_name)}` : "Employee"
  const copyEmail = useCallback(() => {
    if (!employee?.company_email) return
    void navigator.clipboard.writeText(employee.company_email)
    setCopied(true)
    toast.success("Copied email")
    setTimeout(() => setCopied(false), 2000)
  }, [employee?.company_email])
  const handleMailboxActionsChange = useCallback(
    (actions: EmployeeMailboxActions | undefined, invalid: boolean) => {
      props.setEditForm((previous) =>
        JSON.stringify(previous.mailbox_actions) === JSON.stringify(actions) &&
        Boolean(previous.mailbox_actions_invalid) === invalid
          ? previous
          : { ...previous, mailbox_actions: actions, mailbox_actions_invalid: invalid }
      )
    },
    [props]
  )
  const { data: contractCategories = [] } = useQuery<Array<{ id: string; name: string; code: string }>>({
    queryKey: QUERY_KEYS.contractCategories(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_categories")
        .select("id, name, code")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: isOpen,
  })

  if (!employee) return null

  const originalType = employee.employment_type || "full_time"
  const originalCategoryCode = employee.contract_categories?.code || ""
  const isTypeOrCategoryChanged =
    props.editForm.employment_type !== originalType ||
    (props.editForm.employment_type === "contract" && props.editForm.contract_category_code !== originalCategoryCode)
  const currentYear = new Date().getFullYear()
  const expectedIdPreview =
    props.editForm.employment_type === "full_time"
      ? `ACOB/${currentYear}/...`
      : props.editForm.employment_type === "part_time"
        ? `ACOB/PT/${currentYear}/...`
        : `ACOB/${props.editForm.contract_category_code || "SIWES"}/${currentYear}/...`

  const close = () => {
    onOpenChange(false)
    setModalViewMode("profile")
  }

  return (
    <>
      <DetailSheet
        open={isOpen && (modalViewMode === "profile" || modalViewMode === "employment")}
        onOpenChange={(open) => !open && close()}
        title={name}
        leading={<StaffAvatar name={name} profileId={employee.id} size="md" className="border" />}
        description={employee.designation || "Employee"}
        badges={<EmployeeStatusBadge status={employee.employment_status || "active"} />}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalViewMode(modalViewMode === "profile" ? "employment" : "profile")}
            >
              {modalViewMode === "profile" ? "Employment" : "Profile"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => props.onSignature(employee)}>
                <FileSignature className="h-3.5 w-3.5" /> Signature
              </Button>
              {canManageUsers && (
                <Button size="sm" onClick={() => props.onEditEmployee(employee)}>
                  <Edit className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>
          </>
        }
      >
        {modalViewMode === "profile" ? (
          <section className="space-y-3">
            <SectionHeading title="Profile" />
            <DetailList
              items={[
                { label: "Department", value: employee.department },
                { label: "Designation", value: employee.designation },
                { label: "Office", value: employee.office_location },
                { label: "Role", value: employee.role },
                {
                  label: "Email",
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      {employee.company_email || "—"}
                      {employee.company_email && (
                        <Button
                          aria-label="Copy company email"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={copyEmail}
                        >
                          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </span>
                  ),
                  wide: true,
                },
                { label: "Phone", value: employee.phone_number },
                { label: "Address", value: employee.residential_address, wide: true },
              ]}
            />
          </section>
        ) : (
          <section className="space-y-3">
            <SectionHeading title="Employment" />
            <DetailList
              items={[
                { label: "Status", value: employee.employment_status },
                { label: "Type", value: employee.employment_type },
                { label: "Employee ID", value: employee.employee_number },
                { label: "Start date", value: formatDDMMYYYY(employee.employment_date) },
                { label: "Confirmation", value: formatDDMMYYYY(employee.confirmation_date) || "Pending" },
              ]}
            />
            {props.onDispatchCredentials && (
              <Button variant="outline" size="sm" onClick={() => props.onDispatchCredentials?.(employee)}>
                <Mail className="h-3.5 w-3.5" /> Send webmail credentials
              </Button>
            )}
          </section>
        )}
      </DetailSheet>

      <Dialog open={isOpen && modalViewMode === "edit"} onOpenChange={(open) => !open && setModalViewMode("profile")}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit {name}</DialogTitle>
          </DialogHeader>
          <EmployeeEditForm
            viewEmployeeProfile={employee}
            editForm={props.editForm}
            setEditForm={props.setEditForm}
            DEPARTMENTS={departments}
            officeLocations={officeLocations}
            contractCategories={contractCategories}
            getAvailableRoles={props.getAvailableRoles}
            handleMailboxActionsChange={handleMailboxActionsChange}
            isTypeOrCategoryChanged={isTypeOrCategoryChanged}
            expectedIdPreview={expectedIdPreview}
            canManageUsers={canManageUsers}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalViewMode("profile")}>
              Cancel
            </Button>
            <Button onClick={props.onSave} loading={props.isSaving}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isOpen && modalViewMode === "signature"}
        onOpenChange={(open) => !open && setModalViewMode("profile")}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Email signature</DialogTitle>
          </DialogHeader>
          <SignatureCreator profile={employee} variant="selectable" defaultSelectableMode="anniversary" />
        </DialogContent>
      </Dialog>
    </>
  )
}
